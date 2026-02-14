/**
 * ffish Worker - 终极修复版
 * 解决动态 import 模块作用域隔离问题
 */

const WORKER_PATH = self.location.pathname;
const BASE_PATH = WORKER_PATH.substring(0, WORKER_PATH.lastIndexOf('/') + 1);
const FFISH_BASE_PATH = BASE_PATH + 'js/';

console.log('[ffish Worker] Worker路径:', WORKER_PATH);
console.log('[ffish Worker] 基础路径:', BASE_PATH);
console.log('[ffish Worker] JS路径:', FFISH_BASE_PATH);

let currentBoard = null;
let isInitialized = false;
let initError = null;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 加载 ffish.js 并在全局作用域执行
 * 关键：使用 fetch + eval 确保 Module 是全局变量
 */
async function loadFfishScript() {
    console.log('[ffish Worker] 开始加载 ffish.js...');
    
    // ==================== 关键修复：预定义全局 Module ====================
    // 必须在加载 ffish.js 之前设置，这样 ffish.js 会检测到并使用它
    self.Module = {
        // 关键：设置正确的脚本目录，这样 locateFile 的第二个参数才正确
        scriptDirectory: FFISH_BASE_PATH,
        
        // 关键：自定义 locateFile 函数，修正 WASM 路径
        locateFile: function(filename, scriptDir) {
            console.log('[ffish Worker] locateFile 被调用:');
            console.log('  - 请求文件:', filename);
            console.log('  - scriptDir:', scriptDir);
            
            if (filename.endsWith('.wasm')) {
                // WASM 文件在 js/ 目录下
                const wasmPath = FFISH_BASE_PATH + filename;
                console.log('  - 修正为:', wasmPath);
                return wasmPath;
            }
            
            // 其他文件使用默认路径
            return (scriptDir || FFISH_BASE_PATH) + filename;
        },
        
        // 调试回调
        onRuntimeInitialized: function() {
            console.log('[ffish Worker] ✅ Module runtime initialized');
        },
        
        onAbort: function(what) {
            console.error('[ffish Worker] ❌ Module abort:', what);
            initError = what;
        },
        
        // 打印调试信息
        print: function(text) {
            console.log('[ffish.js]', text);
        },
        printErr: function(text) {
            console.error('[ffish.js]', text);
        }
    };
    // =====================================================================
    
    try {
        // 方法：fetch + eval 在全局作用域执行
        // 这样 ffish.js 中的 `var Module` 会引用到全局的 self.Module
        console.log('[ffish Worker] 从路径获取:', FFISH_BASE_PATH + 'ffish.js');
        
        const response = await fetch(FFISH_BASE_PATH + 'ffish.js');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const scriptText = await response.text();
        console.log('[ffish Worker] 获取成功，脚本大小:', scriptText.length, '字节');
        
        // 在全局作用域执行脚本
        // 使用 self.eval 确保在 WorkerGlobalScope 中执行
        console.log('[ffish Worker] 在全局作用域执行脚本...');
        self.eval(scriptText);
        
        console.log('[ffish Worker] 脚本执行完成');
        console.log('[ffish Worker] self.Module 类型:', typeof self.Module);
        console.log('[ffish Worker] self.Module.Board 类型:', typeof self.Module.Board);
        
        // 检查是否成功
        if (typeof self.Module.Board === 'function') {
            console.log('[ffish Worker] ✅ ffish.js 加载成功，Board 类已就绪');
            return true;
        } else {
            // 可能需要等待 WASM 初始化
            console.log('[ffish Worker] Board 类尚未就绪，等待 WASM 初始化...');
            return false;
        }
        
    } catch (error) {
        console.error('[ffish Worker] 加载失败:', error);
        throw error;
    }
}

/**
 * 等待 ffish 初始化完成（WASM 加载完毕）
 */
async function waitForFfishInit() {
    console.log('[ffish Worker] 等待 ffish 初始化...');
    
    let attempts = 0;
    const maxAttempts = 200; // 20秒
    
    while (attempts < maxAttempts) {
        // 检查 Module 和 Board 是否就绪
        if (self.Module && typeof self.Module.Board === 'function') {
            console.log(`[ffish Worker] ✅ ffish 初始化完成 (尝试 ${attempts} 次)`);
            return true;
        }
        
        // 检查是否有错误
        if (initError) {
            console.error('[ffish Worker] 初始化过程中出错:', initError);
            return false;
        }
        
        attempts++;
        if (attempts % 20 === 0) {
            console.log(`[ffish Worker] 等待中... (${attempts}/${maxAttempts})`);
            // 输出当前状态
            console.log('  - self.Module:', typeof self.Module);
            if (self.Module) {
                console.log('  - self.Module.Board:', typeof self.Module.Board);
                console.log('  - self.Module.asm:', typeof self.Module.asm);
                console.log('  - self.Module.ready:', typeof self.Module.ready);
            }
        }
        
        await sleep(100);
    }
    
    console.error('[ffish Worker] 等待超时');
    return false;
}

/**
 * 初始化 ffish 引擎
 */
async function initFfish() {
    if (isInitialized) return Promise.resolve();
    if (initError) return Promise.reject(new Error('初始化已失败: ' + initError));
    
    return new Promise(async (resolve, reject) => {
        try {
            // 加载脚本
            const loaded = await loadFfishScript();
            
            if (!loaded) {
                // 需要等待初始化完成
                const success = await waitForFfishInit();
                
                if (!success) {
                    reject(new Error('ffish 引擎初始化失败或超时'));
                    return;
                }
            }
            
            // 验证 Board 类
            if (typeof self.Module.Board !== 'function') {
                reject(new Error('Board 类不可用'));
                return;
            }
            
            isInitialized = true;
            console.log('[ffish Worker] ✅ ffish 引擎初始化完成');
            resolve();
            
        } catch (error) {
            console.error('[ffish Worker] 初始化错误:', error);
            initError = error.message;
            reject(error);
        }
    });
}

/**
 * 创建象棋棋盘
 */
function createBoard(fen = null) {
    if (!isInitialized || !self.Module || typeof self.Module.Board !== 'function') {
        throw new Error('ffish 引擎尚未初始化');
    }

    // 删除旧棋盘
    if (currentBoard) {
        try {
            currentBoard.delete();
        } catch (e) {}
        currentBoard = null;
    }

    // 创建新棋盘
    try {
        if (fen) {
            currentBoard = new self.Module.Board("xiangqi", fen);
        } else {
            currentBoard = new self.Module.Board("xiangqi");
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
        const testBoard = new self.Module.Board("xiangqi", board.fen());
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
        const result = self.Module.validateFen(fen);
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
                    try {
                        currentBoard.delete();
                    } catch (e) {}
                    currentBoard = null;
                }
                isInitialized = false;
                initError = null;
                self.Module = null;
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
