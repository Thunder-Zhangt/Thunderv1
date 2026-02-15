/**
 * ffish Worker - NNUE 增强版
 * 支持加载外部 NNUE 神经网络文件
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
let nnueLoaded = false;
let initPromise = null;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 加载 NNUE 网络文件
 */
async function loadNNUE() {
    try {
        const nnuePath = FFISH_BASE_PATH + 'xiangqi-c07e94a5c7cb.nnue';
        console.log('[ffish Worker] 尝试加载 NNUE:', nnuePath);
        
        const response = await fetch(nnuePath);
        if (!response.ok) {
            console.warn('[ffish Worker] NNUE 文件未找到，将使用经典评估');
            return false;
        }
        
        const nnueData = await response.arrayBuffer();
        console.log('[ffish Worker] NNUE 文件加载成功，大小:', nnueData.byteLength, '字节');
        
        // 将 NNUE 数据写入虚拟文件系统
        if (self.Module && self.Module.FS) {
            const nnueFilename = 'xiangqi-c07e94a5c7cb.nnue';
            self.Module.FS.writeFile(nnueFilename, new Uint8Array(nnueData));
            console.log('[ffish Worker] NNUE 数据已写入虚拟文件系统');
            
            // 设置 EvalFile 选项
            if (self.Module.setEvalFile) {
                self.Module.setEvalFile(nnueFilename);
            }
            
            nnueLoaded = true;
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('[ffish Worker] NNUE 加载失败:', error);
        return false;
    }
}

/**
 * 加载 ffish.js 并在全局作用域执行
 */
async function loadFfishScript() {
    console.log('[ffish Worker] 开始加载 ffish.js...');
    
    self.Module = {
        scriptDirectory: FFISH_BASE_PATH,
        
        locateFile: function(filename, scriptDir) {
            if (filename.endsWith('.wasm')) {
                return FFISH_BASE_PATH + filename;
            }
            return (scriptDir || FFISH_BASE_PATH) + filename;
        },
        
        onRuntimeInitialized: function() {
            console.log('[ffish Worker] ✅ Module runtime initialized');
        },
        
        onAbort: function(what) {
            console.error('[ffish Worker] ❌ Module abort:', what);
            initError = what;
        },
        
        print: function(text) {
            console.log('[ffish.js]', text);
        },
        
        printErr: function(text) {
            console.error('[ffish.js]', text);
        }
    };
    
    try {
        const response = await fetch(FFISH_BASE_PATH + 'ffish.js');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const scriptText = await response.text();
        console.log('[ffish Worker] 获取成功，脚本大小:', scriptText.length, '字节');
        
        self.eval(scriptText);
        
        console.log('[ffish Worker] 脚本执行完成');
        console.log('[ffish Worker] self.Module 类型:', typeof self.Module);
        console.log('[ffish Worker] self.Module.Board 类型:', typeof self.Module.Board);
        
        if (typeof self.Module.Board === 'function') {
            console.log('[ffish Worker] ✅ ffish.js 加载成功，Board 类已就绪');
            return true;
        } else {
            console.log('[ffish Worker] Board 类尚未就绪，等待 WASM 初始化...');
            return false;
        }
        
    } catch (error) {
        console.error('[ffish Worker] 加载失败:', error);
        throw error;
    }
}

/**
 * 等待 ffish 初始化完成
 */
async function waitForFfishInit() {
    console.log('[ffish Worker] 等待 ffish 初始化...');
    
    let attempts = 0;
    const maxAttempts = 300; // 30秒
    
    while (attempts < maxAttempts) {
        if (self.Module && typeof self.Module.Board === 'function') {
            console.log(`[ffish Worker] ✅ ffish 初始化完成 (尝试 ${attempts} 次)`);
            return true;
        }
        
        if (initError) {
            console.error('[ffish Worker] 初始化过程中出错:', initError);
            return false;
        }
        
        attempts++;
        if (attempts % 50 === 0) {
            console.log(`[ffish Worker] 等待中... (${attempts}/${maxAttempts})`);
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
    
    // 防止重复初始化
    if (initPromise) return initPromise;
    
    initPromise = new Promise(async (resolve, reject) => {
        try {
            const loaded = await loadFfishScript();
            
            if (!loaded) {
                const success = await waitForFfishInit();
                if (!success) {
                    reject(new Error('ffish 引擎初始化失败或超时'));
                    return;
                }
            }
            
            // 加载 NNUE 网络
            await loadNNUE();
            
            if (typeof self.Module.Board !== 'function') {
                reject(new Error('Board 类不可用'));
                return;
            }
            
            isInitialized = true;
            console.log('[ffish Worker] ✅ ffish 引擎初始化完成');
            console.log('[ffish Worker] NNUE 状态:', nnueLoaded ? '已加载' : '未加载（使用经典评估）');
            resolve();
            
        } catch (error) {
            console.error('[ffish Worker] 初始化错误:', error);
            initError = error.message;
            reject(error);
        }
    });
    
    return initPromise;
}

/**
 * 创建象棋棋盘
 */
function createBoard(fen = null) {
    if (!isInitialized || !self.Module || typeof self.Module.Board !== 'function') {
        throw new Error('ffish 引擎尚未初始化');
    }

    if (currentBoard) {
        try {
            currentBoard.delete();
        } catch (e) {}
        currentBoard = null;
    }

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
 * 评估局面 - 使用 NNUE（如果可用）
 */
function evaluatePosition(board) {
    try {
        // 尝试使用 NNUE 评估
        if (self.Module.evaluate && nnueLoaded) {
            return self.Module.evaluate(board);
        }
        
        // 回退到手动评估
        return manualEvaluate(board);
    } catch (e) {
        return manualEvaluate(board);
    }
}

/**
 * 手动评估函数（经典评估）
 */
function manualEvaluate(board) {
    let score = 0;
    const fen = board.fen();
    
    // 子力价值表
    const pieceValues = {
        'r': -900, 'R': 900,    // 车
        'n': -400, 'N': 400,    // 马
        'b': -200, 'B': 200,    // 象
        'a': -200, 'A': 200,    // 士
        'k': -10000, 'K': 10000, // 将/帅
        'c': -450, 'C': 450,    // 炮
        'p': -100, 'P': 100     // 兵/卒
    };
    
    // 计算子力价值
    for (const char of fen.split(' ')[0]) {
        if (pieceValues[char]) {
            score += pieceValues[char];
        }
    }
    
    // 将军加分
    if (board.isCheck()) {
        score += 300;
    }
    
    return score;
}

/**
 * 搜索最佳走法 - 使用 Minimax + Alpha-Beta
 */
async function searchBestMove(fen, timeMs) {
    if (!isInitialized) {
        await initFfish();
    }

    const startTime = Date.now();
    const maxTime = timeMs || 5000;

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

        // 确定当前方（红方为正，黑方为负）
        const isRed = fen.includes(' w ');
        const maximizingPlayer = isRed;

        let bestMove = legalMoves[0];
        let bestScore = maximizingPlayer ? -Infinity : Infinity;
        let depth = 1;
        const maxDepth = 6;

        // 迭代加深搜索
        while (depth <= maxDepth && (Date.now() - startTime) < maxTime * 0.8) {
            let currentBestMove = legalMoves[0];
            let currentBestScore = maximizingPlayer ? -Infinity : Infinity;
            
            for (const move of legalMoves) {
                // 检查时间
                if ((Date.now() - startTime) >= maxTime * 0.9) {
                    break;
                }
                
                const testBoard = new self.Module.Board("xiangqi", board.fen());
                testBoard.push(move);
                
                const score = minimax(testBoard, depth - 1, -Infinity, Infinity, !maximizingPlayer);
                testBoard.delete();
                
                if (maximizingPlayer) {
                    if (score > currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                } else {
                    if (score < currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                }
            }
            
            bestMove = currentBestMove;
            bestScore = currentBestScore;
            
            console.log(`[ffish Worker] 深度 ${depth} 完成，最佳走法: ${bestMove}, 分数: ${bestScore}`);
            depth++;
        }

        board.delete();
        
        console.log(`[ffish Worker] 搜索完成，深度: ${depth - 1}, 最佳走法: ${bestMove}, 分数: ${bestScore}`);
        return { move: bestMove, score: bestScore };
        
    } catch (error) {
        console.error('[ffish Worker] 搜索错误:', error);
        return { move: null, error: error.message };
    }
}

/**
 * Minimax + Alpha-Beta 剪枝
 */
function minimax(board, depth, alpha, beta, maximizingPlayer) {
    // 终止条件
    if (depth === 0) {
        return evaluatePosition(board);
    }
    
    const legalMovesStr = board.legalMoves();
    const legalMoves = legalMovesStr.split(' ').filter(m => m.length > 0);
    
    if (legalMoves.length === 0) {
        if (board.isCheck()) {
            return maximizingPlayer ? -100000 : 100000;
        }
        return 0; // 逼和
    }
    
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of legalMoves) {
            const testBoard = new self.Module.Board("xiangqi", board.fen());
            testBoard.push(move);
            const eval_ = minimax(testBoard, depth - 1, alpha, beta, false);
            testBoard.delete();
            
            maxEval = Math.max(maxEval, eval_);
            alpha = Math.max(alpha, eval_);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of legalMoves) {
            const testBoard = new self.Module.Board("xiangqi", board.fen());
            testBoard.push(move);
            const eval_ = minimax(testBoard, depth - 1, alpha, beta, true);
            testBoard.delete();
            
            minEval = Math.min(minEval, eval_);
            beta = Math.min(beta, eval_);
            if (beta <= alpha) break;
        }
        return minEval;
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
                self.postMessage({ type: 'ready', nnueLoaded, id });
                break;

            case 'search':
                console.log(`[ffish Worker] 开始搜索，FEN: ${fen}, 时间: ${timeMs}ms`);
                const searchResult = await searchBestMove(fen, timeMs);
                
                if (searchResult.error) {
                    self.postMessage({ type: 'error', error: searchResult.error, id });
                } else {
                    self.postMessage({ type: 'move', move: searchResult.move, score: searchResult.score, id });
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
                nnueLoaded = false;
                initError = null;
                initPromise = null;
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

// 不再自动初始化，等待主线程发送 'init' 消息
console.log('[ffish Worker] Worker 已加载，等待初始化指令...');
