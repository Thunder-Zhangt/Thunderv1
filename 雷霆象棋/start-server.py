#!/usr/bin/env python3
"""
雷霆中国象棋 - 快速启动服务器
使用方法：
    python start-server.py
    
或者指定端口：
    python start-server.py 8080
"""

import http.server
import socketserver
import sys
import os

# 默认端口
PORT = 8000

# 允许从命令行指定端口
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        print(f"错误：无效的端口号 '{sys.argv[1]}'")
        print("用法：python start-server.py [端口]")
        sys.exit(1)

# 自定义请求处理，添加WASM的MIME类型
class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加CORS头，允许跨域（开发时使用）
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def guess_type(self, path):
        # 确保.wasm文件使用正确的MIME类型
        if path.endswith('.wasm'):
            return 'application/wasm'
        return super().guess_type(path)

# 检查必要的文件
def check_files():
    required_files = [
        'index.html',
        'style.css',
        'script.js',
        'ai-engine.js',
        'opening-book.js',
        'ffish-worker.js'
    ]
    
    missing = []
    for file in required_files:
        if not os.path.exists(file):
            missing.append(file)
    
    if missing:
        print("⚠️  警告：以下文件缺失：")
        for file in missing:
            print(f"   - {file}")
        print()
    
    # 检查ffish文件
    if not os.path.exists('js/ffish.js'):
        print("❌ 错误：找不到 js/ffish.js")
        print("   请从npm或GitHub下载ffish.js并放入js文件夹")
        print("   查看README.md获取详细说明")
        print()
    
    if not os.path.exists('js/ffish.wasm'):
        print("❌ 错误：找不到 js/ffish.wasm")
        print("   请从npm或GitHub下载ffish.wasm并放入js文件夹")
        print("   查看README.md获取详细说明")
        print()
    
    if os.path.exists('js/ffish.js') and os.path.exists('js/ffish.wasm'):
        print("✅ ffish引擎文件已找到")
        return True
    else:
        print("⚠️  ffish引擎文件缺失，AI功能可能无法正常工作")
        print("   但你可以玩人人对战模式")
        return False

# 主函数
def main():
    print("=" * 50)
    print("   雷霆中国象棋 - 本地服务器")
    print("=" * 50)
    print()
    
    # 检查文件
    ffish_ok = check_files()
    print()
    
    # 创建服务器
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🚀 服务器启动成功！")
        print(f"   访问地址：http://localhost:{PORT}")
        print()
        
        if ffish_ok:
            print("🎮 游戏已就绪，可以开始对战！")
        else:
            print("🎮 人人对战模式可用")
            print("🤖 人机对战需要ffish引擎文件")
        
        print()
        print("按 Ctrl+C 停止服务器")
        print("-" * 50)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print()
            print()
            print("👋 服务器已停止")
            print("感谢使用雷霆中国象棋！")

if __name__ == "__main__":
    main()
