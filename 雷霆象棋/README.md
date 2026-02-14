# 雷霆中国象棋 - 本地ffish引擎版

一款精美的中国象棋游戏，支持人人对战和人机对战（雷霆AI）。本版本使用本地ffish.js和ffish.wasm文件，无需CDN依赖。

## 功能特点

- 人人对战模式
- 人机对战模式（雷霆AI引擎）
- 四种难度级别：幼儿园一霸、小区扛把子、市冠王、神之领域
- 精美的液态玻璃UI设计
- 完整的象棋规则支持（将军、长将检测、困毙等）
- 走棋记录和悔棋功能
- 音效系统

## 文件结构

```
项目根目录/
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 游戏主逻辑
├── ai-engine.js        # 雷霆AI引擎
├── opening-book.js     # 开局棋库
├── ffish-worker.js     # ffish引擎Worker（本地加载版）
├── README.md           # 本文件
└── js/                 # ffish引擎文件夹（你需要创建并放入文件）
    ├── ffish.js        # ffish引擎JS文件（你需要提供）
    └── ffish.wasm      # ffish引擎WASM文件（你需要提供）
```

## 快速开始

### 1. 获取ffish文件

你需要获取以下两个文件：
- `ffish.js` - ffish引擎的JavaScript包装器
- `ffish.wasm` - ffish引擎的WebAssembly二进制文件

**获取方式：**

#### 方式一：从npm下载（推荐）

```bash
# 安装ffish包
npm install ffish

# 或者安装ES6版本
npm install ffish-es6
```

安装后，在 `node_modules/ffish/` 目录下找到：
- `ffish.js`
- `ffish.wasm`

#### 方式二：从GitHub下载

访问 [Fairy-Stockfish GitHub](https://github.com/fairy-stockfish/fairy-stockfish.wasm) 下载最新版本。

#### 方式三：从CDN下载

```bash
# 下载ffish.js
curl -O https://cdn.jsdelivr.net/npm/ffish@latest/ffish.js

# 下载ffish.wasm
curl -O https://cdn.jsdelivr.net/npm/ffish@latest/ffish.wasm
```

### 2. 创建文件夹结构

```bash
# 创建js文件夹
mkdir js

# 将ffish.js和ffish.wasm移动到js文件夹
mv ffish.js js/
mv ffish.wasm js/
```

### 3. 启动游戏

由于使用了WebAssembly和Web Worker，需要通过HTTP服务器访问，不能直接打开HTML文件。

#### 使用Python（推荐）

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### 使用Node.js

```bash
# 安装http-server
npm install -g http-server

# 启动服务器
http-server -p 8000
```

#### 使用VS Code Live Server

安装 Live Server 扩展，右键点击 `index.html` 选择 "Open with Live Server"。

### 4. 访问游戏

打开浏览器访问：`http://localhost:8000`

## GitHub Pages 部署教程

### 1. 创建GitHub仓库

1. 登录GitHub，点击右上角 "+" 号，选择 "New repository"
2. 填写仓库名称，例如 `chinese-chess-thunder-ai`
3. 选择 "Public"（公开）
4. 点击 "Create repository"

### 2. 上传文件

#### 方式一：通过Git命令行

```bash
# 克隆仓库（替换为你的仓库地址）
git clone https://github.com/你的用户名/chinese-chess-thunder-ai.git
cd chinese-chess-thunder-ai

# 复制所有游戏文件到该目录
# 确保包含：
# - index.html
# - style.css
# - script.js
# - ai-engine.js
# - opening-book.js
# - ffish-worker.js
# - js/ffish.js
# - js/ffish.wasm

# 添加文件到Git
git add .

# 提交更改
git commit -m "初始提交：雷霆中国象棋"

# 推送到GitHub
git push origin main
```

#### 方式二：通过GitHub网页上传

1. 在仓库页面点击 "Add file" → "Upload files"
2. 拖放或选择所有文件
3. 点击 "Commit changes"

### 3. 启用GitHub Pages

1. 在仓库页面点击 "Settings"（设置）
2. 左侧菜单选择 "Pages"
3. 在 "Source" 部分选择：
   - Branch: `main` 或 `master`
   - Folder: `/ (root)`
4. 点击 "Save"
5. 等待几分钟，GitHub会提供一个访问链接，例如：
   `https://你的用户名.github.io/chinese-chess-thunder-ai/`

### 4. 验证部署

访问GitHub Pages链接，确保游戏正常运行。

**注意：** 如果ffish.wasm加载失败，可能需要配置MIME类型。GitHub Pages通常会自动处理，但如果遇到问题，可以尝试：

1. 确保 `js/ffish.wasm` 文件已正确上传
2. 检查浏览器控制台是否有404错误
3. 确保仓库是公开的

## 文件说明

### 核心文件

| 文件 | 说明 |
|------|------|
| `index.html` | 游戏主页面，包含UI结构 |
| `style.css` | 样式表，液态玻璃设计风格 |
| `script.js` | 游戏主逻辑，处理用户交互和游戏规则 |
| `ai-engine.js` | 雷霆AI引擎，实现Minimax搜索和评估函数 |
| `opening-book.js` | 开局棋库，包含常见开局变化 |
| `ffish-worker.js` | Web Worker，封装ffish引擎调用 |

### ffish引擎文件（需要自行添加）

| 文件 | 说明 |
|------|------|
| `js/ffish.js` | ffish引擎JS包装器 |
| `js/ffish.wasm` | ffish引擎WebAssembly二进制 |

## 自定义配置

### 修改Worker路径

如果ffish文件不在 `js/` 目录下，需要修改 `script.js` 中的路径：

```javascript
// 在 script.js 中搜索这一行并修改
// 原代码：
gameState.ffishWorker = new Worker('./js/ffish-worker.js');

// 修改为实际路径，例如：
gameState.ffishWorker = new Worker('./path/to/ffish-worker.js');
```

### 修改ffish文件路径

如果ffish.js和ffish.wasm不在js目录下，需要修改 `ffish-worker.js` 中的路径配置：

```javascript
// 在 ffish-worker.js 顶部修改
const FFISH_BASE_PATH = '/你的路径/';
```

## 故障排除

### 问题1：ffish Worker加载失败

**症状：** 控制台显示 "ffish Worker 加载失败" 或 404 错误

**解决方案：**
1. 检查 `js/ffish.js` 和 `js/ffish.wasm` 是否存在
2. 确保通过HTTP服务器访问，而不是直接打开HTML文件
3. 检查浏览器控制台的网络请求，确认文件路径正确

### 问题2：WASM编译错误

**症状：** 控制台显示 "WebAssembly.compile()" 错误

**解决方案：**
1. 确保 `ffish.wasm` 文件完整且未损坏
2. 尝试重新下载ffish文件
3. 确保服务器正确设置了WASM的MIME类型（`application/wasm`）

### 问题3：AI不思考或一直显示"思考中"

**症状：** AI回合没有反应，或一直显示"AI思考中..."

**解决方案：**
1. 检查浏览器控制台是否有JavaScript错误
2. 确保ffish引擎正确初始化（查看控制台日志）
3. 尝试刷新页面重新加载

### 问题4：GitHub Pages上ffish加载失败

**症状：** 本地运行正常，但GitHub Pages上无法加载ffish

**解决方案：**
1. 确保 `js/ffish.wasm` 已提交到GitHub
2. 检查GitHub Pages设置，确保分支和目录正确
3. 等待几分钟让更改生效
4. 尝试强制刷新页面（Ctrl+F5 或 Cmd+Shift+R）

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

需要支持WebAssembly和Web Worker的现代浏览器。

## 技术栈

- HTML5
- CSS3（液态玻璃设计）
- JavaScript (ES6+)
- WebAssembly (ffish引擎)
- Web Worker

## 许可证

本项目仅供学习和娱乐使用。

## 致谢

- [Fairy-Stockfish](https://github.com/fairy-stockfish/fairy-stockfish) - 强大的象棋引擎
- [ffish.js](https://www.npmjs.com/package/ffish) - Fairy-Stockfish的JavaScript绑定

## 联系方式

如有问题或建议，欢迎提交Issue或Pull Request。

---

**祝你游戏愉快！** 🎮♟️
