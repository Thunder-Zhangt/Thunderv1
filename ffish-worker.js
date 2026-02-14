/**
 * ffish Worker - 修复版
 * 解决 WASM 路径加载问题
 */

const WORKER_PATH = self.location.pathname;
const BASE_PATH = WORKER_PATH.substring(0, WORKER_PATH.lastIndexOf('/') + 1);
const FFISH_BASE_PATH = BASE_PATH + 'js/';

console.log('[ffish Worker] Worker路径:', WORKER_PATH);
console.log('[ffish Worker] 基础路径:', BASE_PATH);
console.log('[ffish Worker] JS路径:', FFISH_BASE_PATH);

// ==================== 关键修复：预定义 Module 配置 ====================
// 在加载 ffish.js 之前设置 locateFile，确保 WASM 从正确路径加载
self.Module = {
    locateFile: function(path) {
        console.log('[ffish Worker] locateFile 请求:', path);
        if (path.endsWith('.wasm')) {
            // WASM 文件在 js/ 目录下
            const wasmPath = FFISH_BASE_PATH + path;
            console.log('[ffish Worker] WASM 路径修正为:', wasmPath);
            return wasmPath;
        }
        return path;
    },
    // 添加错误处理
    onAbort: function(what) {
        console.error('[ffish Worker] Module abort:', what);
    },
    onRuntimeInitialized: function() {
        console.log('[ffish Worker] Module runtime initialized');
    }
};
// =====================================================================

let currentBoard = null;
let isInitialized = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待 ffish 全局变量可用
 */
async function waitForFfishGlobal() {
    console.log('[ffish Worker] 等待 ffish 全局变量...');
    
    let attempts = 0;
    const maxAttempts = 150; // 15秒
    
    while (attempts < maxAttempts) {
        // 检查各种可能的全局变量名
        const possibleGlobals = ['ffish', 'Module', 'FFISH'];
        
        for (const name of possibleGlobals) {
            if (self[name] && typeof self[name] === 'object') {
                console.log(`[ffish Worker] 找到全局变量: self.${name}`);
                
                // 检查是否有 Board
                if (typeof self[name].Board === 'function') {
                    console.log(`[ffish Worker] Board 类在 self.${name} 中`);
                    self.ffishModule = self[name];
                    return true;
                }
                
                // 检查 asm
                if (self[name].asm && typeof self[name].asm.Board === 'function') {
                    console.log(`[ffish Worker] Board 类在 self.${name}.asm 中`);
                    self.ffishModule = self[name];
                    self.ffishModule.Board = self[name].asm.Board;
                    return true;
                }
            }
        }
        
        attempts++;
        if (attempts % 10 === 0) {
            console.log(`[ffish Worker] 等待中... (${attempts}/${maxAttempts})`);
        }
        
        await sleep(100);
    }
    
    return false;
}

/**
 * 初始化 ffish 引擎
 */
async function initFfish() {
    if (isInitialized) return Promise.resolve();
    
    return new Promise(async (resolve, reject) => {
        try {
            console.log('[ffish Worker] 尝试加载 ffish.js...');
            console.log('[ffish Worker] 从路径加载:', FFISH_BASE_PATH + 'ffish.js');
            
            // 方法1: 使用 importScripts (同步加载)
            try {
                importScripts(FFISH_BASE_PATH + 'ffish.js');
                console.log('[ffish Worker] importScripts 成功');
            } catch (e) {
                console.log('[ffish Worker] importScripts 失败:', e.message);
                
                // 方法2: 使用动态 import
                try {
                    const mod = await import(FFISH_BASE_PATH + 'ffish.js');
                    console.log('[ffish Worker] 动态 import 成功');
                    
                    // 将 default 导出挂载到全局
                    if (mod.default) {
                        Object.assign(self.Module, mod.default);
                    }
                } catch (e2) {
                    console.error('[ffish Worker] 动态 import 也失败:', e2.message);
                    reject(new Error('无法加载 ffish.js: ' + e2.message));
                    return;
                }
            }
            
            // 等待 ffish 初始化
            const success = await waitForFfishGlobal();
            
            if (success) {
                isInitialized = true;
                console.log('[ffish Worker] ✅ ffish 引擎初始化完成');
                resolve();
            } else {
                // 输出调试信息
                console.log('[ffish Worker] ❌ 调试信息:');
                console.log('  self.ffish:', typeof self.ffish);
                console.log('  self.Module:', typeof self.Module);
                console.log('  self.FFISH:', typeof self.FFISH);
                if (self.Module) {
                    console.log('  self.Module.Board:', typeof self.Module.Board);
                    console.log('  self.Module.asm:', typeof self.Module.asm);
                }
                
                reject(new Error('ffish 引擎初始化超时'));
            }
        } catch (error) {
            console.error('[ffish Worker] 初始化错误:', error);
            reject(error);
        }
    });
}

/**
 * 创建象棋棋盘
 */
function createBoard(fen = null) {
    if (!isInitialized || !self.ffishModule || typeof self.ffishModule.Board !== 'function') {
        throw new Error('ffish 引擎尚未初始化');
    }

    // 删除旧棋盘
    if (currentBoard) {
        currentBoard.delete();
        currentBoard = null;
    }

    // 创建新棋盘
    try {
        if (fen) {
            currentBoard = new self.ffishModule.Board("xiangqi", fen);
        } else {
            currentBoard = new self.ffishModule.Board("xiangqi");
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
        const testBoard = new self.ffishModule.Board("xiangqi", board.fen());
        testBoard.push(move);
        
        let score = Math.random() * 100;
        
        try {
            const lastMove = testBoard.pop();
            if (lastMove && lastMove.isCapture) {
                score += 500;
            }
        } catch (e) {}
        
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
        const result = self.ffishModule.validateFen(fen);
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
                self.ffishModule = null;
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
console.log('[ffish Worker] Worker 已加载，开始自动初始化...');
initFfish().then(() => {
    console.log('[ffish Worker] ✅ ffish 引擎自动初始化完成');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[ffish Worker] ❌ ffish 引擎自动初始化失败:', error);
    self.postMessage({ type: 'error', error: error.message });
});
