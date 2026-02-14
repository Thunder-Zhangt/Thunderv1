/**
 * ffish Worker - 修复版 v3
 * 正确处理 ES6 模块格式的 ffish.js
 * 
 * 关键发现：ffish.js 是 ES6 模块，export default 的是一个函数
 * 需要调用这个函数并等待 Module.ready 才能获取 Board 类
 */

const WORKER_PATH = self.location.pathname;
const BASE_PATH = WORKER_PATH.substring(0, WORKER_PATH.lastIndexOf('/') + 1);
const FFISH_BASE_PATH = BASE_PATH + 'js/';

console.log('[ffish Worker] Worker路径:', WORKER_PATH);
console.log('[ffish Worker] 基础路径:', BASE_PATH);
console.log('[ffish Worker] ffish路径:', FFISH_BASE_PATH);

let ffishModule = null;
let currentBoard = null;
let isInitialized = false;
let boardClass = null;

/**
 * 加载并初始化 ffish ES6 模块
 */
async function loadFfishModule() {
    try {
        console.log('[ffish Worker] 加载 ES6 模块...');
        
        // 使用动态 import 加载 ES6 模块
        const moduleUrl = FFISH_BASE_PATH + 'ffish.js';
        const imported = await import(moduleUrl);
        
        console.log('[ffish Worker] 模块导入成功');
        console.log('[ffish Worker] 导入对象:', Object.keys(imported));
        
        // 获取默认导出（这是一个函数）
        const ModuleFactory = imported.default;
        console.log('[ffish Worker] ModuleFactory 类型:', typeof ModuleFactory);
        
        // 调用函数获取模块实例
        // ffish.js 的 UMD 包装会返回一个对象，包含 ready Promise
        ffishModule = ModuleFactory;
        
        // 如果 Module 是一个函数（需要初始化），等待它完成
        if (ffishModule && typeof ffishModule.then === 'function') {
            console.log('[ffish Worker] 等待 Module.ready...');
            ffishModule = await ffishModule;
        }
        
        // 等待 Module.ready Promise（真正的初始化完成信号）
        if (ffishModule && ffishModule.ready && typeof ffishModule.ready.then === 'function') {
            console.log('[ffish Worker] 等待 ready Promise...');
            await ffishModule.ready;
        }
        
        console.log('[ffish Worker] 模块初始化完成');
        console.log('[ffish Worker] ffishModule 属性:', Object.keys(ffishModule).slice(0, 20));
        
        return true;
    } catch (error) {
        console.error('[ffish Worker] 加载模块失败:', error);
        return false;
    }
}

/**
 * 获取 Board 类
 */
function getBoardClass() {
    if (boardClass) return boardClass;
    if (!ffishModule) return null;
    
    // 尝试各种可能的位置
    if (ffishModule.Board) {
        boardClass = ffishModule.Board;
    } else if (ffishModule['Board']) {
        boardClass = ffishModule['Board'];
    } else if (ffishModule.default && ffishModule.default.Board) {
        boardClass = ffishModule.default.Board;
    }
    
    if (boardClass) {
        console.log('[ffish Worker] Board 类已找到');
    }
    
    return boardClass;
}

/**
 * 初始化 ffish 引擎
 */
async function initFfish() {
    if (isInitialized) return Promise.resolve();
    
    return new Promise(async (resolve, reject) => {
        try {
            // 加载模块
            const loaded = await loadFfishModule();
            if (!loaded) {
                reject(new Error('无法加载 ffish 模块'));
                return;
            }
            
            // 检查 Board 类是否可用
            const Board = getBoardClass();
            if (Board) {
                isInitialized = true;
                console.log('[ffish Worker] ffish 引擎初始化完成');
                resolve();
            } else {
                // Board 类还不可用，可能是初始化还没完成
                // 设置一个轮询检查
                let checkCount = 0;
                const maxChecks = 50; // 5秒
                
                const checkInterval = setInterval(() => {
                    checkCount++;
                    const Board = getBoardClass();
                    
                    if (Board) {
                        clearInterval(checkInterval);
                        isInitialized = true;
                        console.log('[ffish Worker] ffish 引擎初始化完成（轮询）');
                        resolve();
                    } else if (checkCount >= maxChecks) {
                        clearInterval(checkInterval);
                        reject(new Error('ffish 引擎初始化超时，Board 类不可用'));
                    }
                }, 100);
            }
        } catch (error) {
            reject(new Error('ffish 初始化失败: ' + error.message));
        }
    });
}

/**
 * 创建象棋棋盘
 */
function createBoard(fen = null) {
    if (!isInitialized) {
        throw new Error('ffish 引擎尚未初始化');
    }

    const BoardClass = getBoardClass();
    if (!BoardClass) {
        throw new Error('Board 类不可用');
    }

    // 删除旧棋盘
    if (currentBoard) {
        currentBoard.delete();
        currentBoard = null;
    }

    // 创建新棋盘
    try {
        if (fen) {
            currentBoard = new BoardClass("xiangqi", fen);
        } else {
            currentBoard = new BoardClass("xiangqi");
        }
        return currentBoard;
    } catch (error) {
        console.error('[ffish Worker] 创建 Board 失败:', error);
        throw new Error('创建棋盘失败: ' + error.message);
    }
}

/**
 * 搜索最佳走法
 */
async function searchBestMove(fen, timeMs) {
    if (!isInitialized) {
        await initFfish();
    }

    try {
        const board = createBoard(fen);
        const legalMovesStr = board.legalMoves();
        const legalMoves = legalMovesStr.split(' ').filter(m => m.length > 0);

        if (legalMoves.length === 0) {
            if (board.isCheck()) {
                return { move: null, error: '将死' };
            } else {
                return { move: null, error: '逼和' };
            }
        }

        // 简单评估选择最佳走法
        let bestMove = legalMoves[0];
        let bestScore = -Infinity;

        for (const move of legalMoves) {
            const score = await evaluateMove(board, move, timeMs / legalMoves.length);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        board.delete();
        return { move: bestMove, score: bestScore };
    } catch (error) {
        console.error('[ffish Worker] 搜索错误:', error);
        return { move: null, error: error.message };
    }
}

/**
 * 评估走法
 */
async function evaluateMove(board, move, timePerMove) {
    try {
        const BoardClass = getBoardClass();
        if (!BoardClass) return 0;
        
        const testBoard = new BoardClass("xiangqi", board.fen());
        testBoard.push(move);
        
        let score = Math.random() * 100;
        
        // 检查吃子
        try {
            const lastMove = testBoard.pop();
            if (lastMove && lastMove.isCapture) {
                score += 500;
            }
        } catch (e) {
            // ignore
        }
        
        // 检查将军
        if (testBoard.isCheck()) {
            score += 300;
        }
        
        testBoard.delete();
        
        if (timePerMove > 10) {
            await sleep(Math.min(timePerMove, 100));
        }
        
        return score;
    } catch (error) {
        return 0;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getLegalMoves(fen) {
    if (!isInitialized) throw new Error('ffish 引擎尚未初始化');
    
    try {
        const board = createBoard(fen);
        const movesStr = board.legalMoves();
        const moves = movesStr.split(' ').filter(m => m.length > 0);
        board.delete();
        return moves;
    } catch (error) {
        console.error('[ffish Worker] 获取合法走法错误:', error);
        return [];
    }
}

function validateFen(fen) {
    if (!isInitialized) throw new Error('ffish 引擎尚未初始化');
    
    try {
        const result = ffishModule.validateFen(fen);
        return result === 1;
    } catch (error) {
        return false;
    }
}

function makeMove(fen, moveUci) {
    if (!isInitialized) throw new Error('ffish 引擎尚未初始化');
    
    try {
        const board = createBoard(fen);
        board.push(moveUci);
        const newFen = board.fen();
        board.delete();
        return newFen;
    } catch (error) {
        console.error('[ffish Worker] 执行走法错误:', error);
        return null;
    }
}

function checkGameEnd(fen) {
    if (!isInitialized) throw new Error('ffish 引擎尚未初始化');
    
    try {
        const board = createBoard(fen);
        const result = {
            isCheck: board.isCheck(),
            isCheckmate: board.isCheckmate(),
            isStalemate: board.isStalemate(),
            isGameOver: board.isGameOver()
        };
        board.delete();
        return result;
    } catch (error) {
        console.error('[ffish Worker] 检查游戏结束错误:', error);
        return null;
    }
}

// ==================== Worker 消息处理 ====================

self.onmessage = async function(e) {
    const { type, id, fen, timeMs, move } = e.data;

    try {
        switch (type) {
            case 'init':
                await initFfish();
                self.postMessage({ type: 'ready', id });
                break;

            case 'search':
                console.log(`[ffish Worker] 开始搜索，FEN: ${fen}, 时间: ${timeMs}ms`);
                const searchResult = await searchBestMove(fen, timeMs);
                
                if (searchResult.error) {
                    self.postMessage({ type: 'error', error: searchResult.error, id });
                } else {
                    self.postMessage({ type: 'move', move: searchResult.move, id });
                }
                break;

            case 'legalMoves':
                const moves = getLegalMoves(fen);
                self.postMessage({ type: 'legalMoves', moves, id });
                break;

            case 'validateFen':
                const isValid = validateFen(fen);
                self.postMessage({ type: 'validateFen', isValid, id });
                break;

            case 'makeMove':
                const newFen = makeMove(fen, move);
                self.postMessage({ type: 'makeMove', newFen, id });
                break;

            case 'checkGameEnd':
                const gameEnd = checkGameEnd(fen);
                self.postMessage({ type: 'checkGameEnd', result: gameEnd, id });
                break;

            case 'terminate':
                if (currentBoard) {
                    currentBoard.delete();
                    currentBoard = null;
                }
                isInitialized = false;
                boardClass = null;
                ffishModule = null;
                self.postMessage({ type: 'terminated', id });
                break;

            default:
                self.postMessage({ type: 'error', error: `未知的消息类型: ${type}`, id });
        }
    } catch (error) {
        console.error('[ffish Worker] 处理消息错误:', error);
        self.postMessage({ type: 'error', error: error.message, id });
    }
};

// Worker 加载完成后自动初始化
console.log('[ffish Worker] Worker 已加载');
initFfish().then(() => {
    console.log('[ffish Worker] ffish 引擎自动初始化完成');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[ffish Worker] ffish 引擎自动初始化失败:', error);
    self.postMessage({ type: 'error', error: error.message });
});
