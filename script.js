/**
 * script.js 修复补丁 - 修改 Worker 初始化部分
 * 
 * 使用说明：
 * 将下面的 initFfishWorker 函数替换到 script.js 中对应的位置
 */

/**
 * 初始化 ffish Worker - 修复版
 * 增加超时时间，添加更好的错误处理
 */
function initFfishWorker() {
    if (gameState.ffishWorker) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        try {
            // 移除 { type: 'module' }，因为 ffish-worker.js 现在使用 importScripts
            gameState.ffishWorker = new Worker('ffish-worker.js');
            
            let isResolved = false;
            
            gameState.ffishWorker.onmessage = (e) => {
                const { type, error } = e.data;
                
                if (type === 'ready') {
                    if (!isResolved) {
                        isResolved = true;
                        gameState.ffishAvailable = true;
                        console.log('[script] ffish Worker 已就绪');
                        resolve();
                    }
                } else if (type === 'error') {
                    console.error('[script] ffish Worker 错误:', error);
                    gameState.ffishAvailable = false;
                    // 不要 reject，让游戏可以继续使用备用 AI
                    if (!isResolved) {
                        isResolved = true;
                        resolve(); // 解析为成功，但标记为不可用
                    }
                }
            };
            
            gameState.ffishWorker.onerror = (error) => {
                console.error('[script] ffish Worker 加载失败:', error);
                gameState.ffishAvailable = false;
                if (!isResolved) {
                    isResolved = true;
                    resolve(); // 解析为成功，但标记为不可用
                }
            };
            
            // 增加到 15 秒超时（给 wasm 加载更多时间）
            setTimeout(() => {
                if (!isResolved) {
                    console.warn('[script] ffish Worker 初始化超时');
                    gameState.ffishAvailable = false;
                    isResolved = true;
                    resolve(); // 超时也不阻止游戏进行
                }
            }, 15000);
            
        } catch (error) {
            console.error('[script] 创建 Worker 失败:', error);
            gameState.ffishAvailable = false;
            resolve(); // 失败也不阻止游戏进行
        }
    });
}

/**
 * 终止 ffish Worker
 */
function terminateFfishWorker() {
    if (gameState.ffishWorker) {
        try {
            gameState.ffishWorker.postMessage({ type: 'terminate' });
            gameState.ffishWorker.terminate();
        } catch (e) {
            console.log('[script] 终止 Worker 时出错:', e);
        }
        gameState.ffishWorker = null;
        gameState.ffishAvailable = false;
    }
}
