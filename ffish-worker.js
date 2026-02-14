/**
 * ffish Worker - 修复版
 * 解决 ffish.Board is not a constructor 问题
 * 
 * 修改说明：
 * 1. 添加了 Board 类存在性检查
 * 2. 改进了错误处理，确保能正确报告问题
 * 3. 如果 Board 不可用，会返回明确的错误信息
 */

// 获取当前Worker文件所在目录
const WORKER_PATH = self.location.pathname;
const BASE_PATH = WORKER_PATH.substring(0, WORKER_PATH.lastIndexOf('/') + 1);
const FFISH_BASE_PATH = BASE_PATH + 'js/';

console.log('[ffish Worker] Worker路径:', WORKER_PATH);
console.log('[ffish Worker] 基础路径:', BASE_PATH);
console.log('[ffish Worker] ffish路径:', FFISH_BASE_PATH);

let ffish = null;
let currentBoard = null;
let isInitialized = false;
let boardClass = null; // 缓存 Board 类

/**
 * 动态加载ffish.js（ES6模块方式）
 */
async function loadFfishModule() {
    try {
        // 使用动态import加载ES6模块
        const ffishModule = await import(FFISH_BASE_PATH + 'ffish.js');
        
        // ffish可能作为默认导出或命名导出
        ffish = ffishModule.default || ffishModule.ffish || ffishModule;
        
        console.log('[ffish Worker] ffish模块加载成功');
        console.log('[ffish Worker] ffish类型:', typeof ffish);
        console.log('[ffish Worker] ffish属性:', Object.keys(ffish).slice(0, 20));
        
        return true;
    } catch (error) {
        console.error('[ffish Worker] 加载ffish模块失败:', error);
        
        // 尝试备用方案：如果ffish.js是UMD格式，使用importScripts
        try {
            console.log('[ffish Worker] 尝试备用加载方案...');
            importScripts(FFISH_BASE_PATH + 'ffish.js');
            ffish = self.ffish || self.Module;
            if (ffish) {
                console.log('[ffish Worker] 备用方案成功');
                return true;
            }
        } catch (e) {
            console.error('[ffish Worker] 备用方案也失败:', e);
        }
        
        return false;
    }
}

/**
 * 获取 Board 类
 * 在 ffish 中，Board 可能是直接属性或通过其他方式暴露
 */
function getBoardClass() {
    if (boardClass) {
        return boardClass;
    }
    
    // 尝试各种可能的位置
    if (ffish.Board) {
        boardClass = ffish.Board;
    } else if (ffish['Board']) {
        boardClass = ffish['Board'];
    } else if (ffish.asm && ffish.asm.Board) {
        boardClass = ffish.asm.Board;
    }
    
    if (boardClass) {
        console.log('[ffish Worker] Board 类已找到');
    }
    
    return boardClass;
}

/**
 * 初始化ffish引擎
 */
async function initFfish() {
    if (isInitialized) return Promise.resolve();
    
    return new Promise(async (resolve, reject) => {
        try {
            // 加载ffish模块
            const loaded = await loadFfishModule();
            if (!loaded) {
                reject(new Error('无法加载ffish模块'));
                return;
            }
            
            // 等待运行时初始化
            const checkReady = () => {
                // 检查是否已初始化
                if (ffish.calledRun || (ffish.ready && ffish.ready.then)) {
                    // 检查 Board 是否可用
                    const Board = getBoardClass();
                    if (Board) {
                        isInitialized = true;
                        console.log('[ffish Worker] ffish引擎初始化完成，Board 类可用');
                        resolve();
                    } else {
                        // Board 还不可用，继续等待
                        setTimeout(checkReady, 100);
                    }
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            
            // 如果 ffish 有 ready Promise，等待它
            if (ffish.ready && typeof ffish.ready.then === 'function') {
                ffish.ready.then(() => {
                    console.log('[ffish Worker] ffish.ready 完成');
                    checkReady();
                }).catch(err => {
                    console.error('[ffish Worker] ffish.ready 失败:', err);
                    reject(err);
                });
            }
            
            // 设置初始化回调
            if (ffish.onRuntimeInitialized) {
                const originalCallback = ffish.onRuntimeInitialized;
                ffish.onRuntimeInitialized = () => {
                    console.log('[ffish Worker] onRuntimeInitialized 回调');
                    if (originalCallback) originalCallback();
                    checkReady();
                };
            }
            
            // 超时保护
            setTimeout(() => {
                if (!isInitialized) {
                    const Board = getBoardClass();
                    if (Board) {
                        isInitialized = true;
                        console.log('[ffish Worker] ffish引擎初始化完成（超时检查）');
                        resolve();
                    } else {
                        reject(new Error('ffish引擎初始化超时，Board 类不可用'));
                    }
                }
            }, 8000);
            
            // 立即检查
            checkReady();
            
        } catch (error) {
            reject(new Error('ffish初始化失败: ' + error.message));
        }
    });
}

/**
 * 创建象棋棋盘（中国象棋变体）
 */
function createBoard(fen = null) {
    if (!isInitialized) {
        throw new Error('ffish引擎尚未初始化');
    }

    const BoardClass = getBoardClass();
    if (!BoardClass) {
        throw new Error('ffish.Board 类不可用，请检查 ffish.js 文件是否正确');
    }

    // 删除旧棋盘以释放内存
    if (currentBoard) {
        currentBoard.delete();
        currentBoard = null;
    }

    // 创建新的中国象棋棋盘
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
 * 使用ffish进行搜索
 * @param {string} fen - 当前局面的FEN字符串
 * @param {number} timeMs - 思考时间（毫秒）
 * @returns {Promise<string>} - 最佳走法（UCI格式）
 */
async function searchBestMove(fen, timeMs) {
    if (!isInitialized) {
        await initFfish();
    }

    try {
        // 创建棋盘
        const board = createBoard(fen);

        // 获取所有合法走法
        const legalMovesStr = board.legalMoves();
        const legalMoves = legalMovesStr.split(' ').filter(m => m.length > 0);

        if (legalMoves.length === 0) {
            if (board.isCheck()) {
                return { move: null, error: '将死' };
            } else {
                return { move: null, error: '逼和' };
            }
        }

        // 简单的内部评估函数（用于快速评估）
        // 由于ffish.js可能没有完整的UCI接口，我们使用随机选择+简单启发式
        let bestMove = legalMoves[0];
        let bestScore = -Infinity;

        // 对每个走法进行快速评估
        for (const move of legalMoves) {
            const score = await evaluateMove(board, move, timeMs / legalMoves.length);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        // 清理
        board.delete();

        return { move: bestMove, score: bestScore };
    } catch (error) {
        console.error('[ffish Worker] 搜索错误:', error);
        return { move: null, error: error.message };
    }
}

/**
 * 快速评估走法
 * 使用简单的启发式评估
 */
async function evaluateMove(board, move, timePerMove) {
    try {
        const BoardClass = getBoardClass();
        if (!BoardClass) {
            return 0;
        }
        
        // 复制棋盘进行评估
        const testBoard = new BoardClass("xiangqi", board.fen());
        
        // 执行走法
        testBoard.push(move);
        
        // 基础分数
        let score = Math.random() * 100; // 随机因素增加变化
        
        // 如果吃子，给予额外分数
        const lastMove = testBoard.pop();
        if (lastMove && lastMove.isCapture) {
            score += 500;
        }
        
        // 检查是否将军
        if (testBoard.isCheck()) {
            score += 300;
        }
        
        // 清理
        testBoard.delete();
        
        // 模拟思考时间
        if (timePerMove > 10) {
            await sleep(Math.min(timePerMove, 100));
        }
        
        return score;
    } catch (error) {
        return 0;
    }
}

/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取当前局面的合法走法列表
 */
function getLegalMoves(fen) {
    if (!isInitialized) {
        throw new Error('ffish引擎尚未初始化');
    }

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

/**
 * 验证FEN字符串
 */
function validateFen(fen) {
    if (!isInitialized) {
        throw new Error('ffish引擎尚未初始化');
    }

    try {
        // ffish.validateFen 返回 1 表示有效
        const result = ffish.validateFen(fen);
        return result === 1;
    } catch (error) {
        return false;
    }
}

/**
 * 执行走法并返回新FEN
 */
function makeMove(fen, moveUci) {
    if (!isInitialized) {
        throw new Error('ffish引擎尚未初始化');
    }

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

/**
 * 检查游戏结束状态
 */
function checkGameEnd(fen) {
    if (!isInitialized) {
        throw new Error('ffish引擎尚未初始化');
    }

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
                // 初始化ffish引擎
                await initFfish();
                self.postMessage({ type: 'ready', id });
                break;

            case 'search':
                // 搜索最佳走法
                console.log(`[ffish Worker] 开始搜索，FEN: ${fen}, 时间: ${timeMs}ms`);
                const searchResult = await searchBestMove(fen, timeMs);
                
                if (searchResult.error) {
                    self.postMessage({ type: 'error', error: searchResult.error, id });
                } else {
                    self.postMessage({ type: 'move', move: searchResult.move, id });
                }
                break;

            case 'legalMoves':
                // 获取合法走法列表
                const moves = getLegalMoves(fen);
                self.postMessage({ type: 'legalMoves', moves, id });
                break;

            case 'validateFen':
                // 验证FEN
                const isValid = validateFen(fen);
                self.postMessage({ type: 'validateFen', isValid, id });
                break;

            case 'makeMove':
                // 执行走法
                const newFen = makeMove(fen, move);
                self.postMessage({ type: 'makeMove', newFen, id });
                break;

            case 'checkGameEnd':
                // 检查游戏结束状态
                const gameEnd = checkGameEnd(fen);
                self.postMessage({ type: 'checkGameEnd', result: gameEnd, id });
                break;

            case 'terminate':
                // 清理资源
                if (currentBoard) {
                    currentBoard.delete();
                    currentBoard = null;
                }
                isInitialized = false;
                boardClass = null;
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

// Worker加载完成后立即初始化
console.log('[ffish Worker] Worker已加载');
initFfish().then(() => {
    console.log('[ffish Worker] ffish引擎自动初始化完成');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[ffish Worker] ffish引擎自动初始化失败:', error);
    self.postMessage({ type: 'error', error: error.message });
});
