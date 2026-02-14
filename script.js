/**
 * 中国象棋游戏主逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    const PIECE_CHARS = {
    'R': '俥', 'N': '傌', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵',  // 红方（大写）
    'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '砲', 'p': '卒'   // 黑方（小写）
};
    
    const INITIAL_BOARD = [
        ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', 'c', ' ', ' ', ' ', ' ', ' ', 'c', ' '],
        ['p', ' ', 'p', ' ', 'p', ' ', 'p', ' ', 'p'],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        ['P', ' ', 'P', ' ', 'P', ' ', 'P', ' ', 'P'],
        [' ', 'C', ' ', ' ', ' ', ' ', ' ', 'C', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']
    ];
    
    const gameState = {
        mode: 'pvp',
        playerSide: 'red',
        currentPlayer: 'red',
        gameActive: false,
        selectedPiece: null,
        board: [],
        moveHistory: [],
        redCaptured: [],
        blackCaptured: [],
        moveCount: 0,
        soundEnabled: true,
        aiThinking: false,
        gameStartTime: null,
        thunderAI: null,
        // 长将检测：记录局面历史（用于检测三次重复）
        positionHistory: [],
        // 难度设置: 'beginner' | 'intermediate' | 'advanced' | 'master'
        difficulty: 'beginner',
        // ffish Worker 实例
        ffishWorker: null,
        // ffish 是否可用
        ffishAvailable: false
    };
    
    const pages = {
        home: document.getElementById('home-page'),
        game: document.getElementById('game-page'),
        rules: document.getElementById('rules-page')
    };
    
    const modeOptions = document.querySelectorAll('.mode-option');
    const sideOptions = document.querySelectorAll('.side-option');
    const sideSelection = document.getElementById('side-selection');
    const startGameBtn = document.getElementById('start-game');
    const showRulesBtn = document.getElementById('show-rules');
    const backToHomeBtn = document.getElementById('back-to-home');
    const backFromRulesBtn = document.getElementById('back-from-rules');
    const gameModeIndicator = document.getElementById('game-mode-indicator');
    const currentModeSpan = document.getElementById('current-mode');
    const currentTurnSpan = document.getElementById('current-turn');
    const moveCountSpan = document.getElementById('move-count');
    const gameStateSpan = document.getElementById('game-state');
    const chessboard = document.getElementById('chessboard');
    const moveHistoryContainer = document.getElementById('move-history');
    const lastMoveText = document.getElementById('last-move-text');
    const redCapturedContainer = document.getElementById('red-captured').querySelector('.captured-list');
    const blackCapturedContainer = document.getElementById('black-captured').querySelector('.captured-list');
    const redTurnIndicator = document.getElementById('red-turn');
    const blackTurnIndicator = document.getElementById('black-turn');
    
    const undoMoveBtn = document.getElementById('undo-move');
    const resignGameBtn = document.getElementById('resign-game');
    const restartGameBtn = document.getElementById('restart-game');
    const toggleSoundBtn = document.getElementById('toggle-sound');
    
    const modalOverlay = document.getElementById('modal-overlay');
    const alertModal = document.getElementById('alert-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const gameResultModal = document.getElementById('game-result-modal');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertConfirmBtn = document.getElementById('alert-confirm');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');
    const resultNewGameBtn = document.getElementById('result-new-game');
    const resultGoHomeBtn = document.getElementById('result-go-home');
    
    const moveSound = document.getElementById('move-sound');
    const captureSound = document.getElementById('capture-sound');
    const checkSound = document.getElementById('check-sound');
    const victorySound = document.getElementById('victory-sound');
    const defeatSound = document.getElementById('defeat-sound');
    const clickSound = document.getElementById('click-sound');
    
    // ==================== FEN 转换函数 ====================
    
    /**
     * 将内部棋盘转换为 FEN 字符串
     * @param {Array} board - 10x9 二维数组棋盘
     * @param {string} player - 'red' 或 'black'
     * @returns {string} FEN 字符串
     */
    function boardToFEN(board, player) {
        const rows = [];
        for (let r = 0; r < 10; r++) {
            let rowStr = '';
            let empty = 0;
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') {
                    empty++;
                } else {
                    if (empty > 0) {
                        rowStr += empty;
                        empty = 0;
                    }
                    rowStr += p;
                }
            }
            if (empty > 0) rowStr += empty;
            rows.push(rowStr);
        }
        const fen = rows.join('/');
        return `${fen} ${player === 'red' ? 'w' : 'b'} - - 0 1`;
    }
    
    /**
     * 将 UCI 走法转换为内部坐标
     * ffish 输出的 UCI 格式: 列字母 a~i + 行数字 1~10
     * 内部坐标: 行0(黑方底线)~9(红方底线), 列0(左)~8(右)
     * @param {string} uci - UCI 格式走法，如 "h2e2"
     * @returns {Object} {from: {row, col}, to: {row, col}}
     */
    function uciToInternalMove(uci) {
        // 提取 from 列 (a-i)
        const fromCol = uci.charCodeAt(0) - 97; // 'a' = 97
        // 提取 from 行数字（可能多位，如 "10"）
        let i = 1;
        while (i < uci.length && !isNaN(parseInt(uci[i]))) i++;
        const fromRowUCI = parseInt(uci.substring(1, i));
        // 提取 to 列
        const toCol = uci.charCodeAt(i) - 97;
        // 提取 to 行数字
        const toRowUCI = parseInt(uci.substring(i + 1));
        
        // UCI 行号 1-10 对应内部行号 9-0（红方底线是 UCI 行1，内部行9）
        const fromRow = 10 - fromRowUCI;
        const toRow = 10 - toRowUCI;
        
        return {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol }
        };
    }
    
    /**
     * 将内部坐标转换为 UCI 格式
     * @param {Object} from - {row, col}
     * @param {Object} to - {row, col}
     * @returns {string} UCI 格式走法
     */
    function internalMoveToUCI(from, to) {
        const fromColChar = String.fromCharCode(97 + from.col);
        const fromRowUCI = 10 - from.row;
        const toColChar = String.fromCharCode(97 + to.col);
        const toRowUCI = 10 - to.row;
        return `${fromColChar}${fromRowUCI}${toColChar}${toRowUCI}`;
    }
    
    // ==================== ffish Worker 管理 ====================
    
    /**
     * 初始化 ffish Worker
     */
    function initFfishWorker() {
        if (gameState.ffishWorker) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            try {
                gameState.ffishWorker = new Worker('ffish-worker.js', { type: 'module' });
                
                gameState.ffishWorker.onmessage = (e) => {
                    const { type } = e.data;
                    if (type === 'ready') {
                        gameState.ffishAvailable = true;
                        console.log('ffish Worker 已就绪');
                        resolve();
                    } else if (type === 'error') {
                        console.error('ffish Worker 错误:', e.data.error);
                        gameState.ffishAvailable = false;
                        reject(new Error(e.data.error));
                    }
                };
                
                gameState.ffishWorker.onerror = (error) => {
                    console.error('ffish Worker 加载失败:', error);
                    gameState.ffishAvailable = false;
                    reject(error);
                };
                
                // 5秒超时
                setTimeout(() => {
                    if (!gameState.ffishAvailable) {
                        reject(new Error('ffish Worker 初始化超时'));
                    }
                }, 5000);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 终止 ffish Worker
     */
    function terminateFfishWorker() {
        if (gameState.ffishWorker) {
            gameState.ffishWorker.postMessage({ type: 'terminate' });
            gameState.ffishWorker.terminate();
            gameState.ffishWorker = null;
            gameState.ffishAvailable = false;
        }
    }
    
    // ==================== 页面切换函数 ====================
    
    function switchPage(pageName) {
        Object.keys(pages).forEach(key => {
            pages[key].classList.remove('active');
        });
        if (pages[pageName]) {
            pages[pageName].classList.add('active');
        }
    }
    
    function showGameAlert(message, duration = 2000) {
        alertTitle.textContent = '提示';
        alertMessage.textContent = message;
        showModal(alertModal);
        if (duration > 0) {
            setTimeout(() => hideModal(alertModal), duration);
        }
    }
    
    function showConfirm(message, onConfirm) {
        confirmTitle.textContent = '确认';
        confirmMessage.textContent = message;
        const confirmHandler = () => { hideModal(confirmModal); onConfirm?.(); };
        const cancelHandler = () => hideModal(confirmModal);
        confirmYesBtn.onclick = confirmHandler;
        confirmNoBtn.onclick = cancelHandler;
        showModal(confirmModal);
    }
    
    function showModal(modal) {
        modalOverlay.classList.add('active');
        modal.classList.add('active');
    }
    
    function hideModal(modal) {
        modalOverlay.classList.remove('active');
        modal.classList.remove('active');
    }
    
    function playSound(soundElement) {
        if (gameState.soundEnabled && soundElement) {
            soundElement.currentTime = 0;
            soundElement.play().catch(e => console.log('音效播放失败:', e));
        }
    }
    
    // 生成局面哈希（用于检测重复局面）
    function getPositionHash(board, player) {
        let hash = player === 'red' ? 'R' : 'B';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece !== ' ') {
                    hash += `${piece}${r}${c}`;
                }
            }
        }
        return hash;
    }
    
    // 检测是否形成三次重复局面（长将犯规）
    function checkThreefoldRepetition(board, player) {
        const currentHash = getPositionHash(board, player);
        let count = 0;
        for (const record of gameState.positionHistory) {
            if (record.hash === currentHash) {
                count++;
            }
        }
        return count >= 2; // 当前是第3次出现
    }
    
    function areKingsFacingEachOther(board) {
        let redKingRow = -1, redKingCol = -1;
        let blackKingRow = -1, blackKingCol = -1;
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (piece === 'K') {
                    redKingRow = row;
                    redKingCol = col;
                } else if (piece === 'k') {
                    blackKingRow = row;
                    blackKingCol = col;
                }
            }
        }
        
        if (redKingRow === -1 || blackKingRow === -1) return false;
        if (redKingCol !== blackKingCol) return false;
        
        const startRow = Math.min(redKingRow, blackKingRow) + 1;
        const endRow = Math.max(redKingRow, blackKingRow);
        
        for (let row = startRow; row < endRow; row++) {
            if (board[row][redKingCol] !== ' ') return false;
        }
        
        return true;
    }
    
    function isPlayerInStalemate(player) {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece === ' ') continue;
                
                const pieceColor = piece === piece.toLowerCase() ? 'black' : 'red';
                if (pieceColor !== player) continue;
                
                const pieceMoves = getValidMoves(row, col, piece);
                if (pieceMoves.length > 0) return false;
            }
        }
        return true;
    }
    
    function resetGameState() {
        gameState.board = JSON.parse(JSON.stringify(INITIAL_BOARD));
        gameState.moveHistory = [];
        gameState.redCaptured = [];
        gameState.blackCaptured = [];
        gameState.moveCount = 0;
        gameState.currentPlayer = 'red';
        gameState.gameActive = true;
        gameState.selectedPiece = null;
        gameState.aiThinking = false;
        gameState.gameStartTime = Date.now();
        // 初始化局面历史记录（用于检测长将犯规 - 三次重复局面）
        gameState.positionHistory = [];
        
        if (gameState.mode === 'pve') {
            const openingBook = new ChessOpeningBook();
            
            gameState.thunderAI = new ThunderAIEngine({
                depth: 8,
                timeLimit: 12000,
                enableOpeningBook: true,
                openingBook: openingBook,
                enableNullMove: true,
                enableLMR: true,
                enableTransposition: true,
                enableKiller: true,
                enableHistory: true,
                enableSelectiveExtend: true,
                enableTacticalMode: true
            });
        }
    }
    
    function renderBoard() {
        chessboard.innerHTML = '';
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const square = document.createElement('div');
                square.className = 'board-square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                if ((row + col) % 2 === 0) {
                    square.style.backgroundColor = '#f0d9b5';
                } else {
                    square.style.backgroundColor = '#b58863';
                }
                
                const pieceChar = gameState.board[row][col];
                if (pieceChar !== ' ') {
                    const piece = document.createElement('div');
                    piece.className = `piece ${pieceChar === pieceChar.toLowerCase() ? 'black' : 'red'}`;
                    piece.textContent = PIECE_CHARS[pieceChar] || pieceChar;
                    piece.dataset.piece = pieceChar;
                    piece.dataset.row = row;
                    piece.dataset.col = col;
                    
                    piece.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handlePieceClick(row, col);
                    });
                    
                    square.appendChild(piece);
                }
                
                square.addEventListener('click', () => handleSquareClick(row, col));
                chessboard.appendChild(square);
            }
        }
        
        highlightCurrentPlayerPieces();
    }
    
    function highlightCurrentPlayerPieces() {
        document.querySelectorAll('.piece').forEach(piece => {
            const row = parseInt(piece.dataset.row);
            const col = parseInt(piece.dataset.col);
            const pieceChar = gameState.board[row][col];
            const player = pieceChar === pieceChar.toLowerCase() ? 'black' : 'red';
            piece.classList.toggle('current-turn', player === gameState.currentPlayer);
        });
    }
    
    function clearSelection() {
        if (gameState.selectedPiece) {
            const { row, col } = gameState.selectedPiece;
            const pieceElement = document.querySelector(`.piece[data-row="${row}"][data-col="${col}"]`);
            pieceElement?.classList.remove('selected');
            gameState.selectedPiece = null;
        }
        
        document.querySelectorAll('.highlight, .capture-move').forEach(el => {
            el.classList.remove('highlight', 'capture-move');
        });
    }
    
    function selectPiece(row, col) {
        clearSelection();
        const piece = gameState.board[row][col];
        gameState.selectedPiece = { row, col, piece };
        
        const pieceElement = document.querySelector(`.piece[data-row="${row}"][data-col="${col}"]`);
        pieceElement?.classList.add('selected');
        
        const validMoves = getValidMoves(row, col, piece);
        validMoves.forEach(([toRow, toCol]) => {
            const square = document.querySelector(`.board-square[data-row="${toRow}"][data-col="${toCol}"]`);
            if (square) {
                square.classList.add('highlight');
                if (gameState.board[toRow][toCol] !== ' ') {
                    square.classList.add('capture-move');
                }
            }
        });
        
        playSound(clickSound);
    }

    function isOpponentPiece(piece, target) {
        if (target === ' ') return false;
        return (piece === piece.toUpperCase()) !== (target === target.toUpperCase());
    }
    
    function isValidBasicMove(fromRow, fromCol, toRow, toCol, piece) {
        const pieceType = piece.toLowerCase();
        const isRed = piece === piece.toUpperCase();
        const target = gameState.board[toRow][toCol];
        
        if (target !== ' ' && !isOpponentPiece(piece, target)) return false;
        
        switch (pieceType) {
            case 'k':
                const palaceRows = isRed ? [7,8,9] : [0,1,2];
                const palaceCols = [3,4,5];
                if (!palaceRows.includes(toRow) || !palaceCols.includes(toCol)) return false;
                const rowDiff = Math.abs(toRow - fromRow);
                const colDiff = Math.abs(toCol - fromCol);
                return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
            case 'a':
                const advisorRows = isRed ? [7,8,9] : [0,1,2];
                const advisorCols = [3,4,5];
                if (!advisorRows.includes(toRow) || !advisorCols.includes(toCol)) return false;
                const aRowDiff = Math.abs(toRow - fromRow);
                const aColDiff = Math.abs(toCol - fromCol);
                return aRowDiff === 1 && aColDiff === 1;
            case 'b':
                const bRowDiff = Math.abs(toRow - fromRow);
                const bColDiff = Math.abs(toCol - fromCol);
                if (bRowDiff !== 2 || bColDiff !== 2) return false;
                const eyeRow = (fromRow + toRow) / 2;
                const eyeCol = (fromCol + toCol) / 2;
                if (gameState.board[eyeRow][eyeCol] !== ' ') return false;
                if (isRed && toRow < 5) return false;
                if (!isRed && toRow > 4) return false;
                return true;
            case 'n':
                const nRowDiff = Math.abs(toRow - fromRow);
                const nColDiff = Math.abs(toCol - fromCol);
                if (!((nRowDiff === 2 && nColDiff === 1) || (nRowDiff === 1 && nColDiff === 2))) return false;
                let legRow, legCol;
                if (nRowDiff === 2) {
                    legRow = (fromRow + toRow) / 2;
                    legCol = fromCol;
                } else {
                    legRow = fromRow;
                    legCol = (fromCol + toCol) / 2;
                }
                return gameState.board[legRow][legCol] === ' ';
            case 'r':
                const rRowDiff = Math.abs(toRow - fromRow);
                const rColDiff = Math.abs(toCol - fromCol);
                if (rRowDiff !== 0 && rColDiff !== 0) return false;
                const rRowStep = rRowDiff === 0 ? 0 : (toRow > fromRow ? 1 : -1);
                const rColStep = rColDiff === 0 ? 0 : (toCol > fromCol ? 1 : -1);
                let rCurrentRow = fromRow + rRowStep;
                let rCurrentCol = fromCol + rColStep;
                while (rCurrentRow !== toRow || rCurrentCol !== toCol) {
                    if (gameState.board[rCurrentRow][rCurrentCol] !== ' ') return false;
                    rCurrentRow += rRowStep;
                    rCurrentCol += rColStep;
                }
                return true;
            case 'c':
                const cRowDiff = Math.abs(toRow - fromRow);
                const cColDiff = Math.abs(toCol - fromCol);
                if (cRowDiff !== 0 && cColDiff !== 0) return false;
                const cRowStep = cRowDiff === 0 ? 0 : (toRow > fromRow ? 1 : -1);
                const cColStep = cColDiff === 0 ? 0 : (toCol > fromCol ? 1 : -1);
                let cCurrentRow = fromRow + cRowStep;
                let cCurrentCol = fromCol + cColStep;
                let piecesBetween = 0;
                while (cCurrentRow !== toRow || cCurrentCol !== toCol) {
                    if (gameState.board[cCurrentRow][cCurrentCol] !== ' ') piecesBetween++;
                    cCurrentRow += cRowStep;
                    cCurrentCol += cColStep;
                }
                if (target === ' ') return piecesBetween === 0;
                else return piecesBetween === 1;
            case 'p':
                if (isRed) {
                    if (toRow === fromRow - 1 && toCol === fromCol) return true;
                    const isCrossedRiver = fromRow < 5;
                    if (isCrossedRiver && toRow === fromRow) {
                        if (toCol === fromCol - 1 || toCol === fromCol + 1) return true;
                    }
                } else {
                    if (toRow === fromRow + 1 && toCol === fromCol) return true;
                    const isCrossedRiver = fromRow > 4;
                    if (isCrossedRiver && toRow === fromRow) {
                        if (toCol === fromCol - 1 || toCol === fromCol + 1) return true;
                    }
                }
                return false;
        }
        return false;
    }
    
    function moveCausesCheck(fromRow, fromCol, toRow, toCol, piece) {
        const originalTarget = gameState.board[toRow][toCol];
        gameState.board[toRow][toCol] = piece;
        gameState.board[fromRow][fromCol] = ' ';
        
        if (areKingsFacingEachOther(gameState.board)) {
            gameState.board[fromRow][fromCol] = piece;
            gameState.board[toRow][toCol] = originalTarget;
            return true;
        }
        
        const player = piece === piece.toUpperCase() ? 'red' : 'black';
        const inCheck = isKingInCheck(player);
        
        gameState.board[fromRow][fromCol] = piece;
        gameState.board[toRow][toCol] = originalTarget;
        
        return inCheck;
    }
    
    function isKingInCheck(player) {
        const kingChar = player === 'red' ? 'K' : 'k';
        let kingRow = -1, kingCol = -1;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (gameState.board[r][c] === kingChar) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }
        
        if (kingRow === -1) return false;
        
        const opponent = player === 'red' ? 'black' : 'red';
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = gameState.board[r][c];
                if (piece === ' ') continue;
                
                const pieceColor = piece === piece.toLowerCase() ? 'black' : 'red';
                if (pieceColor !== opponent) continue;
                
                if (isValidBasicMove(r, c, kingRow, kingCol, piece)) {
                    const originalTarget = gameState.board[kingRow][kingCol];
                    gameState.board[kingRow][kingCol] = piece;
                    gameState.board[r][c] = ' ';
                    
                    const kingsFaceEachOther = areKingsFacingEachOther(gameState.board);
                    
                    gameState.board[r][c] = piece;
                    gameState.board[kingRow][kingCol] = originalTarget;
                    
                    if (!kingsFaceEachOther) return true;
                }
            }
        }
        
        return false;
    }
    
    function getValidMoves(row, col, piece) {
        const moves = [];
        
        for (let toRow = 0; toRow < 10; toRow++) {
            for (let toCol = 0; toCol < 9; toCol++) {
                if (toRow === row && toCol === col) continue;
                
                if (isValidBasicMove(row, col, toRow, toCol, piece)) {
                    if (!moveCausesCheck(row, col, toRow, toCol, piece)) {
                        moves.push([toRow, toCol]);
                    }
                }
            }
        }
        
        return moves;
    }
    
    function handlePieceClick(row, col) {
        if (!gameState.gameActive || gameState.aiThinking) return;
        
        const piece = gameState.board[row][col];
        if (piece === ' ') return;
        
        const pieceColor = piece === piece.toLowerCase() ? 'black' : 'red';
        
        if (gameState.selectedPiece) {
            const { row: fromRow, col: fromCol, piece: selectedPiece } = gameState.selectedPiece;
            
            if (fromRow === row && fromCol === col) {
                clearSelection();
                return;
            }
            
            if (pieceColor !== gameState.currentPlayer) {
                executeMove(fromRow, fromCol, row, col);
                return;
            }
            
            if (pieceColor === gameState.currentPlayer) {
                selectPiece(row, col);
                return;
            }
        }
        
        if (pieceColor === gameState.currentPlayer) {
            selectPiece(row, col);
        } else {
            showGameAlert('请先选择您的棋子！');
        }
    }
    
    function handleSquareClick(row, col) {
        if (!gameState.gameActive || gameState.aiThinking || !gameState.selectedPiece) return;
        
        const { row: fromRow, col: fromCol } = gameState.selectedPiece;
        if (fromRow === row && fromCol === col) return;
        
        executeMove(fromRow, fromCol, row, col);
    }
    
    function executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = gameState.board[fromRow][fromCol];
        const targetPiece = gameState.board[toRow][toCol];
        
        if (!isValidBasicMove(fromRow, fromCol, toRow, toCol, piece)) {
            showGameAlert('走法不符合规则！');
            clearSelection();
            return;
        }
        
        if (moveCausesCheck(fromRow, fromCol, toRow, toCol, piece)) {
            showGameAlert('走法会导致自己被将军！');
            clearSelection();
            return;
        }
        
        // 保存悔棋前状态（局面历史记录）
        const prevPositionHistory = JSON.parse(JSON.stringify(gameState.positionHistory));

        const moveRecord = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: targetPiece !== ' ' ? targetPiece : null,
            player: gameState.currentPlayer,
            moveNumber: gameState.moveCount + 1,
            positionHistory: prevPositionHistory
        };
        
        if (targetPiece !== ' ') {
            if (gameState.currentPlayer === 'red') {
                gameState.redCaptured.push(targetPiece);
            } else {
                gameState.blackCaptured.push(targetPiece);
            }
            playSound(captureSound);
        } else {
            playSound(moveSound);
        }
        
        gameState.board[toRow][toCol] = piece;
        gameState.board[fromRow][fromCol] = ' ';
        
        if (areKingsFacingEachOther(gameState.board)) {
            const winner = gameState.currentPlayer === 'red' ? '黑方' : '红方';
            const loser = gameState.currentPlayer === 'red' ? '红方' : '黑方';
            setTimeout(() => endGame('kings_face', winner, `${loser}将帅见面，${winner}获胜！`), 100);
            return;
        }
        
        gameState.moveHistory.push(moveRecord);
        gameState.moveCount++;
        
        const opponentKing = gameState.currentPlayer === 'red' ? 'k' : 'K';
        let kingFound = false;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (gameState.board[r][c] === opponentKing) {
                    kingFound = true;
                    break;
                }
            }
            if (kingFound) break;
        }
        
        if (!kingFound) {
            const winner = gameState.currentPlayer === 'red' ? '红方' : '黑方';
            setTimeout(() => endGame('checkmate', winner, `${winner}绝杀获胜！`), 100);
            return;
        }
        
        // 长将检测逻辑（正确版：检测三次重复局面）
        const opponent = gameState.currentPlayer === 'red' ? 'black' : 'red';
        const givesCheck = isKingInCheck(opponent);
        
        // 记录当前局面（在对方走棋前的状态）
        const currentHash = getPositionHash(gameState.board, opponent);
        gameState.positionHistory.push({ 
            hash: currentHash, 
            player: opponent,
            isCheck: givesCheck 
        });
        
        // 检测是否形成三次重复局面（且当前是将军状态）
        if (givesCheck && checkThreefoldRepetition(gameState.board, opponent)) {
            const winnerText = gameState.currentPlayer === 'red' ? '黑方' : '红方';
            const loserText = gameState.currentPlayer === 'red' ? '红方' : '黑方';
            setTimeout(() => endGame('perpetual_check', winnerText,
                `${loserText}长将犯规（三次重复局面），判负！`), 100);
            return;
        }

        if (givesCheck) {
            playSound(checkSound);
            showGameAlert(`${opponent === 'red' ? '红方' : '黑方'}被将军！`, 2000);
        }
        
        gameState.currentPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';
        
        if (isPlayerInStalemate(gameState.currentPlayer)) {
            const isCheck = isKingInCheck(gameState.currentPlayer);
            const winner = gameState.currentPlayer === 'red' ? '黑方' : '红方';
            const loser = gameState.currentPlayer === 'red' ? '红方' : '黑方';
            
            if (isCheck) {
                setTimeout(() => endGame('checkmate', winner, `${loser}被将军且无棋可走，${winner}绝杀获胜！`), 100);
            } else {
                setTimeout(() => endGame('stalemate', winner, `${loser}被困毙，${winner}获胜！`), 100);
            }
            return;
        }
        
        clearSelection();
        renderBoard();
        updateGameUI();
        updateCapturedPieces();
        recordMove(moveRecord);
        updateLastMoveDisplay(moveRecord);
        
        if (gameState.mode === 'pve' && gameState.gameActive) {
            const isAITurn = (gameState.playerSide === 'red' && gameState.currentPlayer === 'black') ||
                            (gameState.playerSide === 'black' && gameState.currentPlayer === 'red');
            
            if (isAITurn) {
                setTimeout(() => makeAIMove(), 800);
            }
        }
    }
    
    /**
     * 显示 AI 思考中动画
     */
    function showAIThinking() {
        const indicator = document.getElementById('ai-thinking-indicator');
        if (indicator) {
            indicator.classList.add('active');
        }
    }
    
    /**
     * 隐藏 AI 思考中动画
     */
    function hideAIThinking() {
        const indicator = document.getElementById('ai-thinking-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }
    
    /**
     * 获取当前难度对应的思考时间
     */
    function getThinkingTime() {
        switch (gameState.difficulty) {
            case 'intermediate': return 2000;  // 中级：2秒
            case 'advanced': return 4000;      // 高级：4秒
            case 'master': return 8000;        // 特级：8秒
            default: return 500;               // 初级：0.5秒
        }
    }
    
    /**
     * 获取难度显示名称
     */
    function getDifficultyName() {
        switch (gameState.difficulty) {
            case 'beginner': return '幼儿园一霸';
            case 'intermediate': return '小区扛把子';
            case 'advanced': return '市冠王';
            case 'master': return '神之领域';
            default: return '幼儿园一霸';
        }
    }
    
    /**
     * 使用 ffish 引擎思考
     */
    async function makeFfishMove() {
        return new Promise(async (resolve, reject) => {
            try {
                // 确保 ffish Worker 已初始化
                if (!gameState.ffishWorker || !gameState.ffishAvailable) {
                    await initFfishWorker();
                }
                
                const fen = boardToFEN(gameState.board, gameState.currentPlayer);
                const timeMs = getThinkingTime();
                const searchId = Date.now();
                
                console.log(`[ffish] 开始搜索，FEN: ${fen}, 时间: ${timeMs}ms`);
                
                // 设置超时保护
                const timeoutId = setTimeout(() => {
                    reject(new Error('ffish 搜索超时'));
                }, timeMs + 3000);
                
                // 监听消息
                const messageHandler = (e) => {
                    const { type, move, error, id } = e.data;
                    
                    if (id !== searchId) return; // 忽略旧消息
                    
                    clearTimeout(timeoutId);
                    gameState.ffishWorker.removeEventListener('message', messageHandler);
                    
                    if (type === 'move') {
                        console.log(`[ffish] 搜索结果: ${move}`);
                        const internalMove = uciToInternalMove(move);
                        resolve(internalMove);
                    } else if (type === 'error') {
                        reject(new Error(error));
                    }
                };
                
                gameState.ffishWorker.addEventListener('message', messageHandler);
                gameState.ffishWorker.postMessage({ 
                    type: 'search', 
                    fen: fen, 
                    timeMs: timeMs,
                    id: searchId
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 使用雷霆 AI 思考（初级难度）
     */
    async function makeThunderAIMove() {
        // 设置初级难度参数
        gameState.thunderAI.setDifficulty('beginner');
        
        const aiMove = await gameState.thunderAI.searchBestMove(
            gameState.board, 
            gameState.currentPlayer, 
            gameState.moveHistory, 
            gameState.positionHistory
        );
        
        if (aiMove.isResign) {
            const winner = gameState.currentPlayer === 'red' ? '红方' : '黑方';
            setTimeout(() => endGame('ai_resign', winner, `AI认输，${winner}获胜！`), 100);
            return null;
        }
        
        return aiMove;
    }
    
    /**
     * 主 AI 走棋函数 - 根据难度选择引擎
     */
    async function makeAIMove() {
        if (!gameState.gameActive || gameState.aiThinking) return;
        
        gameState.aiThinking = true;
        showAIThinking();
        
        try {
            let aiMove = null;
            
            if (gameState.difficulty === 'beginner') {
                // 初级：使用雷霆 AI
                console.log('[AI] 使用雷霆 AI（初级）');
                aiMove = await makeThunderAIMove();
            } else {
                // 中级及以上：使用 ffish
                console.log(`[AI] 使用 ffish（${getDifficultyName()}）`);
                try {
                    aiMove = await makeFfishMove();
                } catch (ffishError) {
                    console.error('ffish 错误，回退到雷霆 AI:', ffishError);
                    // ffish 失败时回退到雷霆 AI
                    aiMove = await makeThunderAIMove();
                }
            }
            
            if (aiMove && aiMove.from && aiMove.to) {
                gameState.selectedPiece = {
                    row: aiMove.from.row,
                    col: aiMove.from.col,
                    piece: gameState.board[aiMove.from.row][aiMove.from.col]
                };
                
                executeMove(aiMove.from.row, aiMove.from.col, aiMove.to.row, aiMove.to.col);
            }
        } catch (error) {
            console.error('AI思考错误:', error);
            // 最终回退：使用简单 AI
            const simpleMove = getBestAIMove();
            if (simpleMove) {
                gameState.selectedPiece = {
                    row: simpleMove.from.row,
                    col: simpleMove.from.col,
                    piece: gameState.board[simpleMove.from.row][simpleMove.from.col]
                };
                executeMove(simpleMove.from.row, simpleMove.from.col, simpleMove.to.row, simpleMove.to.col);
            }
        } finally {
            gameState.aiThinking = false;
            hideAIThinking();
        }
    }
    
    function getBestAIMove() {
        const aiSide = gameState.currentPlayer;
        const moves = [];
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = gameState.board[r][c];
                if (piece === ' ') continue;
                
                const pieceColor = piece === piece.toLowerCase() ? 'black' : 'red';
                if (pieceColor !== aiSide) continue;
                
                for (let toR = 0; toR < 10; toR++) {
                    for (let toC = 0; toC < 9; toC++) {
                        if (toR === r && toC === c) continue;
                        
                        if (isValidBasicMove(r, c, toR, toC, piece)) {
                            if (!moveCausesCheck(r, c, toR, toC, piece)) {
                                moves.push({
                                    from: { row: r, col: c },
                                    to: { row: toR, col: toC },
                                    piece: piece
                                });
                            }
                        }
                    }
                }
            }
        }
        
        if (moves.length === 0) return null;
        
        const pieceValues = {
            'k': 10000, 'K': 10000,
            'a': 200, 'A': 200,
            'b': 200, 'B': 200,
            'n': 400, 'N': 400,
            'r': 900, 'R': 900,
            'c': 450, 'C': 450,
            'p': 100, 'P': 100
        };
        
        const captureMoves = moves.filter(move => 
            gameState.board[move.to.row][move.to.col] !== ' '
        );
        
        if (captureMoves.length > 0) {
            captureMoves.sort((a, b) => {
                const targetA = gameState.board[a.to.row][a.to.col];
                const targetB = gameState.board[b.to.row][b.to.col];
                return (pieceValues[targetB] || 0) - (pieceValues[targetA] || 0);
            });
            return captureMoves[0];
        }
        
        return moves[Math.floor(Math.random() * moves.length)];
    }
    
    function updateGameUI() {
        redTurnIndicator.classList.toggle('active', gameState.currentPlayer === 'red');
        blackTurnIndicator.classList.toggle('active', gameState.currentPlayer === 'black');
        
        currentTurnSpan.textContent = gameState.currentPlayer === 'red' ? '红方' : '黑方';
        currentTurnSpan.className = gameState.currentPlayer === 'red' ? 'red-turn' : 'black-turn';
        moveCountSpan.textContent = gameState.moveCount;
        gameStateSpan.textContent = gameState.gameActive ? '进行中' : '已结束';
    }
    
    function updateCapturedPieces() {
        redCapturedContainer.innerHTML = '';
        blackCapturedContainer.innerHTML = '';
        
        gameState.redCaptured.forEach(piece => {
            const elem = document.createElement('div');
            elem.className = 'captured-piece';
            elem.textContent = PIECE_CHARS[piece];
            elem.style.color = piece === piece.toLowerCase() ? '#6b7280' : '#dc2626';
            redCapturedContainer.appendChild(elem);
        });
        
        gameState.blackCaptured.forEach(piece => {
            const elem = document.createElement('div');
            elem.className = 'captured-piece';
            elem.textContent = PIECE_CHARS[piece];
            elem.style.color = piece === piece.toLowerCase() ? '#1e293b' : '#dc2626';
            blackCapturedContainer.appendChild(elem);
        });
    }
    
    function recordMove(move) {
        const moveNumber = Math.ceil((gameState.moveCount + 1) / 2);
        let moveRecord = document.querySelector(`.move-record[data-move="${moveNumber}"]`);
        
        if (!moveRecord) {
            moveRecord = document.createElement('div');
            moveRecord.className = 'move-record';
            moveRecord.dataset.move = moveNumber;
            
            const moveNumberSpan = document.createElement('span');
            moveNumberSpan.className = 'move-number';
            moveNumberSpan.textContent = `${moveNumber}.`;
            
            const moveRedSpan = document.createElement('span');
            moveRedSpan.className = 'move-red';
            const moveBlackSpan = document.createElement('span');
            moveBlackSpan.className = 'move-black';
            
            moveRecord.appendChild(moveNumberSpan);
            moveRecord.appendChild(moveRedSpan);
            moveRecord.appendChild(moveBlackSpan);
            moveHistoryContainer.appendChild(moveRecord);
        }
        
        const fromCol = 9 - move.from.col;
        const toCol = 9 - move.to.col;
        const fromRow = 10 - move.from.row;
        const toRow = 10 - move.to.row;
        const moveText = `${PIECE_CHARS[move.piece]} ${fromCol}${fromRow}→${toCol}${toRow}`;
        
        if (move.player === 'red') {
            moveRecord.querySelector('.move-red').textContent = moveText;
        } else {
            moveRecord.querySelector('.move-black').textContent = moveText;
        }
        
        moveHistoryContainer.scrollTop = moveHistoryContainer.scrollHeight;
    }
    
    function updateLastMoveDisplay(move) {
        const fromCol = 9 - move.from.col;
        const toCol = 9 - move.to.col;
        const fromRow = 10 - move.from.row;
        const toRow = 10 - move.to.row;
        let text = `${PIECE_CHARS[move.piece]} ${fromCol}${fromRow} → ${toCol}${toRow}`;
        if (move.captured) text += ` (吃${PIECE_CHARS[move.captured]})`;
        lastMoveText.textContent = text;
    }
    
    function clearMoveHistory() {
        moveHistoryContainer.innerHTML = '';
        lastMoveText.textContent = '暂无';
    }
    
    function endGame(reason, winner, message) {
        if (!gameState.gameActive) return;
        
        gameState.gameActive = false;
        gameState.aiThinking = false;
        
        let title, icon, iconColor;
        
        switch (reason) {
            case 'checkmate':
                title = '将军绝杀！';
                icon = 'fa-trophy';
                iconColor = winner === '红方' ? '#dc2626' : '#1e293b';
                break;
            case 'stalemate':
                title = '困毙！';
                icon = 'fa-chess-board';
                iconColor = '#3b82b6';
                break;
            case 'perpetual_check':
                title = '长将犯规！';
                icon = 'fa-gavel';
                iconColor = '#dc2626';
                break;
            case 'kings_face':
                title = '将帅见面！';
                icon = 'fa-chess-king';
                iconColor = '#f59e0b';
                break;
            case 'resign':
                title = '认输！';
                icon = 'fa-flag';
                iconColor = '#94a3b8';
                break;
            case 'ai_resign':
                title = 'AI认输！';
                icon = 'fa-robot';
                iconColor = winner === '红方' ? '#dc2626' : '#1e293b';
                break;
            default:
                title = '游戏结束';
                icon = 'fa-chess-board';
                iconColor = '#3b82b6';
        }
        
        resultTitle.textContent = title;
        resultMessage.textContent = message || `${winner}获胜！`;
        resultIcon.className = `fas ${icon}`;
        resultIcon.style.color = iconColor;

        // 播放胜利/失败音效
        const isPlayerWin = (gameState.mode === 'pvp') ||
            (gameState.mode === 'pve' &&
                ((gameState.playerSide === 'red' && winner === '红方') ||
                 (gameState.playerSide === 'black' && winner === '黑方')));

        if (reason === 'resign') {
            // 认输时播放失败音效
            playSound(defeatSound);
        } else if (isPlayerWin) {
            playSound(victorySound);
        } else {
            playSound(defeatSound);
        }

        showModal(gameResultModal);
    }
    
    async function initGame() {
        try {
            resetGameState();
            
            const modeText = gameState.mode === 'pvp' ? '人人对战' : '雷霆人机';
            gameModeIndicator.textContent = modeText;
            currentModeSpan.textContent = modeText;
            
            updateGameUI();
            renderBoard();
            updateCapturedPieces();
            clearMoveHistory();
            
            switchPage('game');
            
            if (gameState.mode === 'pve' && gameState.playerSide === 'black') {
                setTimeout(() => makeAIMove(), 800);
            }
            
            showGameAlert(`${modeText}模式开始！`);
            
        } catch (error) {
            console.error('初始化失败:', error);
            showGameAlert('游戏初始化失败，请刷新重试', 3000);
        }
    }
    
    function undoMove() {
        if (!gameState.gameActive || gameState.moveHistory.length === 0 || gameState.aiThinking) {
            showGameAlert('当前不能悔棋！');
            return;
        }
        
        const isPvE = gameState.mode === 'pve';
        const canUndoTwo = isPvE && gameState.moveHistory.length >= 2;
        const stepsToUndo = canUndoTwo ? 2 : 1;
        
        for (let i = 0; i < stepsToUndo; i++) {
            const lastMove = gameState.moveHistory.pop();
            
            gameState.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
            gameState.board[lastMove.to.row][lastMove.to.col] = lastMove.captured || ' ';
            
            // 恢复长将检测状态（局面历史记录）
            if (lastMove.positionHistory) {
                gameState.positionHistory = JSON.parse(JSON.stringify(lastMove.positionHistory));
            }
            
            if (lastMove.captured) {
                if (lastMove.player === 'red') {
                    gameState.redCaptured.pop();
                } else {
                    gameState.blackCaptured.pop();
                }
            }
            
            gameState.moveCount--;
            
            if (i === stepsToUndo - 1) {
                gameState.currentPlayer = lastMove.player;
            }
        }
        
        clearSelection();
        renderBoard();
        updateGameUI();
        updateCapturedPieces();
        updateMoveHistoryDisplay();
        
        showGameAlert(canUndoTwo ? '悔棋成功（回退人机步和您的步）！' : '悔棋成功！');
    }
    
    function updateMoveHistoryDisplay() {
        clearMoveHistory();
        gameState.moveHistory.forEach(move => recordMove(move));
    }
    
    function resignGame() {
        if (!gameState.gameActive) return;
        
        showConfirm('确定要认输吗？', () => {
            const winner = gameState.currentPlayer === 'red' ? '黑方' : '红方';
            endGame('resign', winner, '您已认输！');
        });
    }
    
    function restartGame() {
        if (gameState.gameActive) {
            showConfirm('确定要重新开始吗？当前对局将丢失。', () => {
                initGame();
            });
        } else {
            initGame();
        }
    }
    
    function toggleSound() {
        gameState.soundEnabled = !gameState.soundEnabled;
        const icon = toggleSoundBtn.querySelector('i');
        
        if (gameState.soundEnabled) {
            icon.className = 'fas fa-volume-up';
            icon.style.color = '#3b82b6';
            playSound(moveSound);
        } else {
            icon.className = 'fas fa-volume-mute';
            icon.style.color = '#94a3b8';
        }
    }
    
    function bindEvents() {
        // 难度选择元素
        const difficultySelection = document.getElementById('difficulty-selection');
        const difficultyOptions = document.querySelectorAll('.difficulty-option');
        
        modeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                playSound(clickSound);
                modeOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                gameState.mode = opt.dataset.mode;
                sideSelection.style.display = gameState.mode === 'pve' ? 'block' : 'none';
                // 显示/隐藏难度选择
                if (difficultySelection) {
                    difficultySelection.style.display = gameState.mode === 'pve' ? 'block' : 'none';
                }
            });
        });

        sideOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                playSound(clickSound);
                sideOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                gameState.playerSide = opt.dataset.side;
            });
        });
        
        // 难度选择事件
        difficultyOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                playSound(clickSound);
                difficultyOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                gameState.difficulty = opt.dataset.difficulty;
                console.log('难度选择:', gameState.difficulty);
            });
        });
        
        startGameBtn.addEventListener('click', () => {
            playSound(clickSound);
            initGame();
        });
        showRulesBtn.addEventListener('click', () => {
            playSound(clickSound);
            switchPage('rules');
        });
        backToHomeBtn.addEventListener('click', () => {
            playSound(clickSound);
            if (gameState.gameActive) {
                showConfirm('返回主页面将丢失当前对局，确定吗？', () => {
                    switchPage('home');
                    gameState.gameActive = false;
                    gameState.thunderAI = null;
                });
            } else {
                switchPage('home');
            }
        });
        backFromRulesBtn.addEventListener('click', () => {
            playSound(clickSound);
            switchPage('home');
        });

        undoMoveBtn.addEventListener('click', () => {
            playSound(clickSound);
            undoMove();
        });
        resignGameBtn.addEventListener('click', () => {
            playSound(clickSound);
            resignGame();
        });
        restartGameBtn.addEventListener('click', () => {
            playSound(clickSound);
            restartGame();
        });
        toggleSoundBtn.addEventListener('click', toggleSound);
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                playSound(clickSound);
                hideModal(btn.closest('.modal'));
            });
        });
        alertConfirmBtn.addEventListener('click', () => {
            playSound(clickSound);
            hideModal(alertModal);
        });
        modalOverlay.addEventListener('click', () => {
            playSound(clickSound);
            document.querySelectorAll('.modal').forEach(modal => hideModal(modal));
        });

        resultNewGameBtn.addEventListener('click', () => {
            playSound(clickSound);
            hideModal(gameResultModal);
            initGame();
        });
        resultGoHomeBtn.addEventListener('click', () => {
            playSound(clickSound);
            hideModal(gameResultModal);
            switchPage('home');
            gameState.gameActive = false;
            gameState.thunderAI = null;
        });
    }
    
    function initApp() {
        bindEvents();
        sideSelection.style.display = 'none';
        switchPage('home');
        
        [moveSound, captureSound, checkSound, victorySound, defeatSound, clickSound].forEach(sound => sound.load());
        
        console.log('中国象棋游戏初始化完成');
    }
    
    initApp();
    
    // ==================== 评论系统 ====================
    (function initCommentSystem() {
        const commentList = document.getElementById('comment-list');
        const commentInput = document.getElementById('comment-input');
        const commentSubmit = document.getElementById('comment-submit');
        const avatarOptions = document.querySelectorAll('.avatar-option');
        
        // 预设评论数据
        const presetComments = [
            { avatar: 'red', gender: 'male', name: '红方高手', content: '这AI太强了，根本赢不了！', time: '2分钟前' },
            { avatar: 'black', gender: 'female', name: '黑棋女王', content: '刚刚用双炮绝杀赢了AI，太爽了！', time: '5分钟前' },
            { avatar: 'red', gender: 'male', name: '象棋大师', content: '界面设计得很精美，下棋体验很好。', time: '10分钟前' },
            { avatar: 'black', gender: 'male', name: '老将出马', content: '雷霆AI确实厉害，思考速度很快。', time: '15分钟前' },
            { avatar: 'red', gender: 'female', name: '红粉佳人', content: '喜欢人人对战模式，和朋友一起玩很有趣！', time: '20分钟前' },
            { avatar: 'black', gender: 'male', name: '棋逢对手', content: '刚刚学会马后炮，实战用出来了！', time: '30分钟前' },
            { avatar: 'red', gender: 'male', name: '楚河汉界', content: '中国象棋博大精深，越玩越有意思。', time: '1小时前' },
            { avatar: 'black', gender: 'female', name: '棋盘仙子', content: '这个游戏的音效很棒，吃子的时候很有感觉。', time: '2小时前' }
        ];
        
        let selectedAvatar = 'red';
        
        // 获取性别图标
        function getGenderIcon(gender) {
            return gender === 'male' 
                ? '<i class="fas fa-mars male-icon"></i>' 
                : '<i class="fas fa-venus female-icon"></i>';
        }
        
        // 创建评论元素
        function createCommentElement(comment) {
            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';
            
            const avatarClass = comment.avatar === 'red' ? 'red' : 'black';
            const avatarText = comment.avatar === 'red' ? '帅' : '将';
            
            commentItem.innerHTML = `
                <div class="comment-avatar ${avatarClass}">
                    <span class="avatar-piece ${avatarClass}">${avatarText}</span>
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-name">${comment.name}</span>
                        <span class="comment-gender">${getGenderIcon(comment.gender)}</span>
                        <span class="comment-time">${comment.time}</span>
                    </div>
                    <div class="comment-text">${comment.content}</div>
                </div>
            `;
            
            return commentItem;
        }
        
        // 渲染预设评论
        function renderPresetComments() {
            commentList.innerHTML = '';
            presetComments.forEach(comment => {
                commentList.appendChild(createCommentElement(comment));
            });
        }
        
        // 添加新评论
        function addComment() {
            const content = commentInput.value.trim();
            if (!content) {
                commentInput.placeholder = '请输入评论内容...';
                commentInput.focus();
                return;
            }
            
            const gender = document.querySelector('input[name="comment-gender"]:checked').value;
            const avatar = selectedAvatar;
            
            // 生成随机用户名
            const names = {
                red: { male: ['红方勇士', '红帅传人', '楚河霸主'], female: ['红妆棋姬', '红颜棋手', '红方佳人'] },
                black: { male: ['黑将门徒', '汉界王者', '黑方战神'], female: ['黑棋仙子', '墨香棋韵', '黑方女王'] }
            };
            const nameList = names[avatar][gender];
            const randomName = nameList[Math.floor(Math.random() * nameList.length)];
            
            const newComment = {
                avatar: avatar,
                gender: gender,
                name: randomName,
                content: content,
                time: '刚刚'
            };
            
            // 添加到列表顶部
            const commentElement = createCommentElement(newComment);
            commentList.insertBefore(commentElement, commentList.firstChild);
            
            // 清空输入框
            commentInput.value = '';
            
            // 滚动到顶部
            commentList.scrollTop = 0;
        }
        
        // 头像选择事件
        avatarOptions.forEach(option => {
            option.addEventListener('click', () => {
                avatarOptions.forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                selectedAvatar = option.dataset.avatar;
            });
        });
        
        // 提交按钮事件
        commentSubmit.addEventListener('click', addComment);
        
        // 回车提交
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addComment();
            }
        });
        
        // 初始化渲染
        renderPresetComments();
    })();
});
