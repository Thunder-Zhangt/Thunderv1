#!/usr/bin/env node
/**
 * 雷霆中国象棋 - 快速启动服务器 (Node.js版本)
 * 使用方法：
 *     node start-server.js
 *     
 * 或者指定端口：
 *     node start-server.js 8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8000;

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon'
};

// 检查文件是否存在
function checkFiles() {
    const requiredFiles = [
        'index.html',
        'style.css',
        'script.js',
        'ai-engine.js',
        'opening-book.js',
        'ffish-worker.js'
    ];
    
    const missing = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missing.length > 0) {
        console.log('⚠️  警告：以下文件缺失：');
        missing.forEach(file => console.log(`   - ${file}`));
        console.log();
    }
    
    // 检查ffish文件
    const ffishJsExists = fs.existsSync('js/ffish.js');
    const ffishWasmExists = fs.existsSync('js/ffish.wasm');
    
    if (!ffishJsExists) {
        console.log('❌ 错误：找不到 js/ffish.js');
        console.log('   请从npm或GitHub下载ffish.js并放入js文件夹');
        console.log('   查看README.md获取详细说明');
        console.log();
    }
    
    if (!ffishWasmExists) {
        console.log('❌ 错误：找不到 js/ffish.wasm');
        console.log('   请从npm或GitHub下载ffish.wasm并放入js文件夹');
        console.log('   查看README.md获取详细说明');
        console.log();
    }
    
    if (ffishJsExists && ffishWasmExists) {
        console.log('✅ ffish引擎文件已找到');
        return true;
    } else {
        console.log('⚠️  ffish引擎文件缺失，AI功能可能无法正常工作');
        console.log('   但你可以玩人人对战模式');
        return false;
    }
}

// 创建服务器
const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // 添加CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 启动服务器
console.log('='.repeat(50));
console.log('   雷霆中国象棋 - 本地服务器');
console.log('='.repeat(50));
console.log();

const ffishOk = checkFiles();
console.log();

server.listen(PORT, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`   访问地址：http://localhost:${PORT}`);
    console.log();
    
    if (ffishOk) {
        console.log('🎮 游戏已就绪，可以开始对战！');
    } else {
        console.log('🎮 人人对战模式可用');
        console.log('🤖 人机对战需要ffish引擎文件');
    }
    
    console.log();
    console.log('按 Ctrl+C 停止服务器');
    console.log('-'.repeat(50));
});

// 处理退出
process.on('SIGINT', () => {
    console.log();
    console.log();
    console.log('👋 服务器已停止');
    console.log('感谢使用雷霆中国象棋！');
    process.exit(0);
});
