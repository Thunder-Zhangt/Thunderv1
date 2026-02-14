/**
 * ffish Worker - 本地加载版本
 * 使用本地ffish.js和ffish.wasm文件
 * 
 * 文件结构要求：
 * - ffish.js 和 ffish.wasm 必须与该worker文件在同一目录下
 * - 或者通过 FFISH_BASE_PATH 变量指定路径
 */

// 配置：ffish文件的基础路径（自动检测）
// 获取当前Worker文件所在目录，然后指向js子目录
// 例如：/Thunderv1/ffish-worker.js -> /Thunderv1/js/
const WORKER_PATH = self.location.pathname;
const BASE_PATH = WORKER_PATH.substring(0, WORKER_PATH.lastIndexOf('/') + 1);
const FFISH_BASE_PATH = BASE_PATH + 'js/';

console.log('[ffish Worker] Worker路径:', WORKER_PATH);
console.log('[ffish Worker] 基础路径:', BASE_PATH);
console.log('[ffish Worker] ffish路径:', FFISH_BASE_PATH);

// 导入ffish.js（使用本地文件）
importScripts(FFISH_BASE_PATH + 'ffish.js');

let ffish = null;
let currentBoard = null;
let isInitialized = false;

/**
 * 初始化ffish引擎
 */
function initFfish() {
    return new Promise((resolve, reject) => {
        if (isInitialized) {
            resolve();
            return;
        }

        try {
            // ffish.js 使用 Emscripten 编译，全局变量名为 'ffish'
            // 等待WASM运行时初始化完成
            if (typeof ffishModule !== 'undefined') {
                ffish = ffishModule;
            } else if (typeof Module !== 'undefined') {
                ffish = Module;
            } else {
                // 尝试从全局作用域获取
                ffish = self.ffish || self.Module;
            }

            if (!ffish) {
                reject(new Error('无法找到ffish模块，请确保ffish.js已正确加载'));
                return;
            }

            // 等待运行时初始化
            if (ffish.calledRun) {
                // 已经初始化完成
                isInitialized = true;
                resolve();
            } else {
                // 设置初始化回调
                ffish['onRuntimeInitialized'] = () => {
                    isInitialized = true;
                    console.log('[ffish Worker] ffish引擎初始化完成');
                    resolve();
                };

                // 设置超时保护
                setTimeout(() => {
                    if (!isInitialized) {
                        reject(new Error('ffish引擎初始化超时（5秒）'));
                    }
                }, 5000);
            }
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

    // 删除旧棋盘以释放内存
    if (currentBoard) {
        currentBoard.delete();
        currentBoard = null;
    }

    // 创建新的中国象棋棋盘
    if (fen) {
        currentBoard = new ffish.Board("xiangqi", fen);
    } else {
        currentBoard = new ffish.Board("xiangqi");
    }

    return currentBoard;
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
        // 复制棋盘进行评估
        const testBoard = new ffish.Board("xiangqi", board.fen());
        
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
console.log('[ffish Worker] Worker已加载，路径:', FFISH_BASE_PATH);
initFfish().then(() => {
    console.log('[ffish Worker] ffish引擎自动初始化完成');
    self.postMessage({ type: 'ready' });
}).catch(error => {
    console.error('[ffish Worker] ffish引擎自动初始化失败:', error);
    self.postMessage({ type: 'error', error: error.message });
});
