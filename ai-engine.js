/**
 * 雷霆AI引擎 v5.0 - 子力价值深度优化版
 * 优化内容：
 * 1. 基于科学研究的动态子力价值系统（开局/中局/残局）
 * 2. 精细化的位置价值表（Piece-Square Tables）
 * 3. 兵卒位置价值细化（高兵/低兵/底兵/花心兵）
 * 4. 炮架数量动态影响炮的价值
 * 5. 马的灵活性评估
 * 6. 士象完整度评估
 * 
 * 子力价值参考：
 * - 车：开局9分，中局9-10分，残局10分
 * - 炮：开局4.5-5分（炮架多），中局4.5分，残局4分（炮架少）
 * - 马：开局4分（易蹩腿），中局4-5分，残局4.5-5分（通行无阻）
 * - 士/象：开局2分，中残局3分（防守关键）
 * - 兵：未过河0.5-1分，过河高兵2-3分，低兵2分，底兵1分，花心兵接近马炮
 */
const PIECE_CHARS = {
    'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒',
    'R': '车', 'N': '马', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵'
};

class ThunderAIEngine {
    constructor(options = {}) {
        this.config = {
            depth: 8,
            timeLimit: 12000,
            maxDepth: 20,
            enablePVS: true,
            enableNullMove: true,
            enableLMR: true,
            enableTransposition: true,
            enableKiller: true,
            enableHistory: true,
            enableAspiration: true,
            enableOpeningBook: true,
            enableSelectiveExtend: true,
            enableTacticalMode: true,
            enableEndgameBook: true,
            enableMidgameBook: true,
            enableTrapBook: true,
            nullMoveDepthReduction: 2,
            lmrBaseDepth: 3,
            lmrMoveThreshold: 4,
            lmrLogBase: 2.2,
            deltaMargin: 900,
            materialWeight: 1.0,
            mobilityWeight: 0.5,
            positionWeight: 1.5,
            kingSafetyWeight: 2.0,
            pawnStructureWeight: 0.8,
            threatWeight: 1.2,
            coordinationWeight: 1.5,
            controlWeight: 1.0,
            activityWeight: 0.8,
            ...options
        };

        this.openingBook = this.config.openingBook || null;
        this.currentOpeningMode = null;
        this.openingMoves = 0;

        this.initializeDataStructures();
        this.initializeValues();
        this.difficulty = 'normal'; // 默认难度

        console.log('雷霆AI引擎 v5.0 子力价值深度优化版初始化完成');
    }

    /**
     * 设置难度级别
     * @param {string} level - 'beginner' | 'normal' | 'hard'
     */
    setDifficulty(level) {
        this.difficulty = level;
        
        if (level === 'beginner') {
            // 初级（幼儿园一霸）：简单难度
            this.config.depth = 2;
            this.config.timeLimit = 500;
            this.config.enableNullMove = false;
            this.config.lmrBaseDepth = 0;
            this.config.materialWeight = 0.8;
            this.config.enableOpeningBook = false;
            this.config.enableTacticalMode = false;
            console.log('雷霆AI：已设置为初级难度（幼儿园一霸）');
        } else if (level === 'normal') {
            // 中级：标准难度
            this.config.depth = 6;
            this.config.timeLimit = 3000;
            this.config.enableNullMove = true;
            this.config.lmrBaseDepth = 3;
            this.config.materialWeight = 1.0;
            this.config.enableOpeningBook = true;
            this.config.enableTacticalMode = true;
            console.log('雷霆AI：已设置为中级难度');
        } else if (level === 'hard') {
            // 高级：困难难度
            this.config.depth = 8;
            this.config.timeLimit = 8000;
            this.config.enableNullMove = true;
            this.config.lmrBaseDepth = 3;
            this.config.materialWeight = 1.2;
            this.config.enableOpeningBook = true;
            this.config.enableTacticalMode = true;
            console.log('雷霆AI：已设置为高级难度');
        }
    }

    initializeDataStructures() {
        this.transpositionTable = new Map();
        this.evaluationCache = new Map();
        this.historyTable = new Int32Array(10 * 9 * 10 * 9);
        this.killerMoves = new Array(150).fill().map(() => [
            { from: null, to: null, score: 0 },
            { from: null, to: null, score: 0 }
        ]);
        this.counterMoves = new Array(10 * 9 * 10 * 9).fill(null);
        this.focusAreas = [];
        
        this.tacticalPatterns = null; 
        
        this.stats = {
            nodesSearched: 0, qNodesSearched: 0, transpositionHits: 0,
            cutoffs: 0, nullMovePrunes: 0, lmReductions: 0, deltaPrunes: 0,
            searchStartTime: 0, maxDepthReached: 0, extensions: 0,
            tacticalPrunes: 0, selectiveExtensions: 0,
            bookHits: { opening: 0, tactic: 0, endgame: 0, midgame: 0, trap: 0 }
        };

        this.dynamicParams = {
            gamePhase: 'opening', phaseFactor: 0.0, timePressure: false,
            complexity: 1.0, strategicPlan: 'develop', positionType: 'balanced'
        };

        this.zobristKeys = this.initZobristKeys();
    }

    /**
     * ==================== 子力价值系统（核心优化）====================
     * 基于科学研究的动态子力价值评估
     */
    initializeValues() {
        // 基础子力价值（以100分为单位，便于微调）
        this.basePieceValues = {
            'k': 100000, 'K': 100000,  // 将帅：无限价值
            'a': 200, 'A': 200,        // 士：基础200分
            'b': 200, 'B': 200,        // 象：基础200分
            'n': 400, 'N': 400,        // 马：基础400分
            'r': 900, 'R': 900,        // 车：基础900分
            'c': 450, 'C': 450,        // 炮：基础450分
            'p': 100, 'P': 100         // 兵：基础100分
        };

        // 阶段调整后的子力价值
        this.pieceValues = { ...this.basePieceValues };
        
        // 创建精细化的位置价值表
        this.positionTables = this.createScientificPositionTables();
        
        // 兵卒位置价值表（单独处理，因为兵的价值随位置变化最大）
        this.pawnPositionValues = this.createPawnPositionTables();
    }

    /**
     * 获取当前阶段的动态子力价值
     */
    getDynamicPieceValues(phase) {
        const values = { ...this.basePieceValues };
        
        switch(phase) {
            case 'opening':
                // 开局：炮略优于马（炮架多），车尽快出动
                values.c = 500; values.C = 500;  // 炮：500分
                values.n = 400; values.N = 400;  // 马：400分
                values.r = 900; values.R = 900;  // 车：900分
                values.p = 50;  values.P = 50;   // 未过河兵：50分
                values.a = 180; values.A = 180;  // 士：180分
                values.b = 180; values.B = 180;  // 象：180分
                break;
                
            case 'midgame':
                // 中局：马炮价值接近，兵过河后价值提升
                values.c = 450; values.C = 450;  // 炮：450分
                values.n = 450; values.N = 450;  // 马：450分
                values.r = 950; values.R = 950;  // 车：950分
                values.p = 150; values.P = 150;  // 过河兵：150分
                values.a = 220; values.A = 220;  // 士：220分
                values.b = 220; values.B = 220;  // 象：220分
                break;
                
            case 'late_midgame':
                // 中残局过渡：马略优于炮，兵价值继续提升
                values.c = 420; values.C = 420;  // 炮：420分
                values.n = 480; values.N = 480;  // 马：480分
                values.r = 980; values.R = 980;  // 车：980分
                values.p = 200; values.P = 200;  // 高兵：200分
                values.a = 250; values.A = 250;  // 士：250分
                values.b = 250; values.B = 250;  // 象：250分
                break;
                
            case 'endgame':
                // 残局：马优于炮（通行无阻），高兵价值倍增
                values.c = 400; values.C = 400;  // 炮：400分（缺炮架）
                values.n = 500; values.N = 500;  // 马：500分
                values.r = 1000; values.R = 1000; // 车：1000分
                values.p = 250; values.P = 250;  // 高兵：250分
                values.a = 280; values.A = 280;  // 士：280分
                values.b = 280; values.B = 280;  // 象：280分
                break;
        }
        
        return values;
    }

    /**
     * 创建科学的位置价值表（基于象棋巫师等成熟引擎）
     * 每个位置值表示该棋子在此位置的额外价值（百分制）
     */
    createScientificPositionTables() {
        const tables = {};
        
        // ==================== 帅/将位置表 ====================
        // 帅应尽量待在原位，必要时出帅助攻
        tables['K'] = [
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0, 10, 15, 10,  0,  0,  0],  // 九宫底线
            [  0,  0,  0, 15, 20, 15,  0,  0,  0],  // 九宫中线
            [  0,  0,  0, 10, 15, 10,  0,  0,  0]   // 九宫顶线（原位）
        ];
        tables['k'] = this.flipTableVertically(tables['K']);
        
        // ==================== 车位置表 ====================
        // 车应尽量占领通线，控制中心，避免低头
        tables['R'] = [
            [ 60, 60, 60, 65, 70, 65, 60, 60, 60],  // 底线：车宜通头，不宜低头
            [ 55, 55, 55, 60, 65, 60, 55, 55, 55],
            [ 50, 50, 50, 55, 60, 55, 50, 50, 50],
            [ 45, 45, 45, 50, 55, 50, 45, 45, 45],
            [ 40, 40, 40, 45, 50, 45, 40, 40, 40],  // 河界
            [ 45, 45, 45, 50, 55, 50, 45, 45, 45],  // 过河后价值提升
            [ 50, 50, 50, 55, 60, 55, 50, 50, 50],
            [ 55, 55, 55, 60, 65, 60, 55, 55, 55],
            [ 60, 60, 60, 65, 70, 65, 60, 60, 60],
            [ 65, 65, 65, 70, 75, 70, 65, 65, 65]   // 对方底线：沉底车
        ];
        tables['r'] = this.flipTableVertically(tables['R']);
        
        // ==================== 马位置表 ====================
        // 马应往中心跳，避免戍边，卧槽位和挂角位价值极高
        tables['N'] = [
            [  0,  0,  5,  0,  0,  0,  5,  0,  0],  // 边马价值低
            [  0, 10,  0,  0,  0,  0,  0, 10,  0],
            [  5,  0, 15,  0,  0,  0, 15,  0,  5],
            [  0,  0,  0, 20,  0, 20,  0,  0,  0],
            [  0,  0,  0,  0, 25,  0,  0,  0,  0],  // 河口马
            [  0,  0, 20,  0,  0,  0, 20,  0,  0],
            [  0, 25,  0, 30,  0, 30,  0, 25,  0],  // 卧槽位(2,7),(6,7)附近
            [ 35,  0, 40,  0, 45,  0, 40,  0, 35],  // 挂角位和卧槽位
            [  0, 45,  0, 50,  0, 50,  0, 45,  0],  // 卧槽马位置价值极高
            [  0,  0,  0,  0,  0,  0,  0,  0,  0]
        ];
        tables['n'] = this.flipTableVertically(tables['N']);
        
        // ==================== 炮位置表 ====================
        // 炮应占领要道，沉底炮价值高，残局应归家
        tables['C'] = [
            [ 40, 40, 40, 45, 50, 45, 40, 40, 40],  // 底线炮（沉底炮）
            [ 35, 35, 35, 40, 45, 40, 35, 35, 35],
            [ 30, 30, 30, 35, 40, 35, 30, 30, 30],
            [ 25, 25, 25, 30, 35, 30, 25, 25, 25],
            [ 20, 20, 20, 25, 30, 25, 20, 20, 20],  // 河界
            [ 25, 25, 25, 30, 35, 30, 25, 25, 25],
            [ 30, 30, 30, 35, 40, 35, 30, 30, 30],
            [ 35, 35, 35, 40, 45, 40, 35, 35, 35],
            [ 40, 40, 40, 45, 50, 45, 40, 40, 40],
            [ 45, 45, 45, 50, 55, 50, 45, 45, 45]   // 原位炮：中炮价值最高
        ];
        tables['c'] = this.flipTableVertically(tables['C']);
        
        // ==================== 士位置表 ====================
        // 士应守护九宫，撑起羊角士
        tables['A'] = [
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0, 15,  0, 15,  0,  0,  0],  // 羊角士位置
            [  0,  0,  0,  0, 20,  0,  0,  0,  0],  // 中心士
            [  0,  0,  0, 15,  0, 15,  0,  0,  0]   // 原位士
        ];
        tables['a'] = this.flipTableVertically(tables['A']);
        
        // ==================== 相位置表 ====================
        // 相应连环，不宜散边
        tables['B'] = [
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0, 10,  0,  0,  0, 10,  0,  0],
            [  0,  0,  0,  0,  0,  0,  0,  0,  0],
            [  0,  0, 15,  0,  0,  0, 15,  0,  0],  // 连环象位置
            [  0,  0,  0,  0,  0,  0,  0,  0,  0]
        ];
        tables['b'] = this.flipTableVertically(tables['B']);
        
        return tables;
    }

    /**
     * 创建兵卒位置价值表（单独处理，因为兵的价值随位置变化最大）
     * 兵卒价值分级：
     * - 未过河（row 5-9 for red）：基础价值
     * - 过河高兵（row 3-4）：价值提升
     * - 低兵（row 1-2）：价值较高
     * - 底兵（row 0）：价值最低（老兵无功）
     * - 花心兵（row 0/9, col 4）：价值最高
     */
    createPawnPositionTables() {
        const tables = {};
        
        // 红方兵位置表（从红方视角，row 9是底线，row 0是对方底线）
        tables['P'] = [
            [  0,  0,  0,  0,200,  0,  0,  0,  0],  // 对方底线：底兵价值低，但花心兵极高
            [ 10, 10, 10, 20,80, 20, 10, 10, 10],   // 底二路（低兵）
            [ 20, 20, 30, 40,60, 40, 30, 20, 20],   // 宫顶线（低兵）
            [ 30, 30, 40, 50,50, 50, 40, 30, 30],   // 卒林线（高兵）
            [ 40, 40, 50, 60,60, 60, 50, 40, 40],   // 巡河线（高兵）
            [ 20, 20, 25, 30,35, 30, 25, 20, 20],   // 刚过河
            [ 10, 10, 15, 20,25, 20, 15, 10, 10],   // 河界附近
            [  5,  5, 10, 15,20, 15, 10,  5,  5],   // 己方区域
            [  0,  0,  5, 10,15, 10,  5,  0,  0],   // 初始位置附近
            [  0,  0,  0,  5,10,  5,  0,  0,  0]    // 初始位置
        ];
        
        // 黑方卒位置表（垂直翻转）
        tables['p'] = this.flipTableVertically(tables['P']);
        
        return tables;
    }

    /**
     * 垂直翻转表格（用于黑方）
     */
    flipTableVertically(table) {
        const flipped = [];
        for (let r = 0; r < 10; r++) {
            flipped[r] = [...table[9 - r]];
        }
        return flipped;
    }

    /**
     * ==================== 核心搜索（保持原有）====================
     */
    async searchBestMove(board, player, moveHistory = [], positionHistory = []) {
        this.resetStats();
        
        // 保存局面历史用于长将检测
        this.positionHistory = positionHistory || [];
        
        this.analyzeGamePhase(board, moveHistory);
        
        // 更新动态子力价值
        this.pieceValues = this.getDynamicPieceValues(this.dynamicParams.gamePhase);
        
        this.focusAreas = this.identifyFocusAreas(board, player);
        
        // 阶段1：棋库查询（不计入AI思考时间）
        const bookMove = this.findBestBookMoveWithValidation(board, player, moveHistory);
        if (bookMove) {
            console.log(`📚 使用棋库 [${bookMove.source}]:`, bookMove.notation);
            if (bookMove.source.includes('opening')) this.stats.bookHits.opening++;
            if (bookMove.source.includes('tactic')) this.stats.bookHits.tactic++;
            if (bookMove.source.includes('endgame')) this.stats.bookHits.endgame++;
            if (bookMove.source.includes('midgame')) this.stats.bookHits.midgame++;
            if (bookMove.source.includes('trap')) this.stats.bookHits.trap++;
            return bookMove;
        }

        // 阶段2：紧急检查（被将军时应着）
        const emergencyMove = this.checkEmergency(board, player);
        if (emergencyMove) return emergencyMove;

        // 阶段3：真正开始AI计算
        this.stats.searchStartTime = Date.now();
        console.log(`🤖 棋库未命中，启动深度搜索，限时${this.config.timeLimit}ms`);

        // 生成所有合法走法
        const allMoves = this.generateAllMoves(board, player);
        const legalMoves = [];
        for (const move of allMoves) {
            if (this.validateMoveStrict(board, move, player)) {
                move.givesCheck = this.wouldGiveCheck(board, move.from, move.to, player);
                legalMoves.push(move);
            }
        }

        if (legalMoves.length === 0) return this.noMovesAvailable(board, player);

        // 过滤掉会导致三次重复局面的走法（避免长将犯规）
        const filteredMoves = this.filterThreefoldRepetition(board, legalMoves, player);
        const candidateMoves = this.filterAndSortMoves(board, filteredMoves.length > 0 ? filteredMoves : legalMoves, player);
        
        // 迭代加深搜索
        let bestMove = candidateMoves[0];
        let bestScore = -Infinity;
        const targetDepth = this.calculateDynamicDepth();

        for (let depth = 1; depth <= targetDepth; depth++) {
            if (this.isTimeCritical(0.7)) {
                console.log(`⏱️ 时间不足，停止于深度 ${depth-1}`);
                break;
            }

            let currentBestScore = -Infinity;
            let currentBestMove = candidateMoves[0];
            let currentAlpha, currentBeta;

            if (this.config.enableAspiration && depth >= 4 && bestScore > -9000) {
                const window = 50 + depth * 5;
                currentAlpha = bestScore - window;
                currentBeta = bestScore + window;
            } else {
                currentAlpha = -Infinity;
                currentBeta = Infinity;
            }

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                const undoInfo = this.makeMove(board, move.from, move.to);

                if (this.illegalPosition(board) || this.isInCheck(board, player)) {
                    this.undoMove(board, undoInfo);
                    continue;
                }

                let extraDepth = 0;
                if (this.config.enableSelectiveExtend) {
                    extraDepth = this.calculateExtension(board, move, player, depth, i);
                }

                let score;
                try {
                    if (i === 0) {
                        score = -this.pvsSearch(board, depth - 1 + extraDepth, -currentBeta, -currentAlpha,
                            this.getOpponent(player), move, 1);
                    } else {
                        score = -this.pvsSearch(board, depth - 1 + extraDepth, -currentAlpha - 1, -currentAlpha,
                            this.getOpponent(player), move, 1);

                        if (score > currentAlpha && score < currentBeta) {
                            score = -this.pvsSearch(board, depth - 1 + extraDepth, -currentBeta, -currentAlpha,
                                this.getOpponent(player), move, 1);
                        }
                    }
                } finally {
                    this.undoMove(board, undoInfo);
                }

                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = move;
                }

                if (score > currentAlpha) {
                    currentAlpha = score;
                    if (!move.isCapture) this.updateHistory(move, depth);
                }

                if (currentAlpha >= currentBeta) {
                    if (!move.isCapture) this.updateKiller(move, 1, score);
                    break;
                }

                if ((i & 0x7) === 0 && this.isTimeCritical(0.9)) break;
            }

            if (!this.isTimeCritical(0.95)) {
                bestScore = currentBestScore;
                bestMove = currentBestMove;
                this.stats.maxDepthReached = depth;

                const bestIdx = candidateMoves.indexOf(bestMove);
                if (bestIdx > 0) {
                    candidateMoves.splice(bestIdx, 1);
                    candidateMoves.unshift(bestMove);
                }
            }

            if (bestScore > 9000) break;
        }

        if (!bestMove || !this.validateMoveStrict(board, bestMove, player)) {
            console.warn('⚠️ 首选走法未通过验证，重新选择');
            bestMove = this.selectSafeMove(board, candidateMoves, player);
        }

        this.logStatistics();
        return bestMove || candidateMoves[0];
    }
    
    /**
     * 过滤会导致三次重复局面的走法（避免长将犯规）
     */
    filterThreefoldRepetition(board, moves, player) {
        const opponent = this.getOpponent(player);
        const safeMoves = [];
        
        for (const move of moves) {
            const undoInfo = this.makeMove(board, move.from, move.to);
            
            // 检查这步棋是否会导致将军
            const givesCheck = this.isInCheck(board, opponent);
            
            if (givesCheck) {
                // 如果是将军，检查是否会导致三次重复局面
                const posHash = this.getPositionHash(board, opponent);
                let repetitionCount = 0;
                
                for (const record of this.positionHistory) {
                    if (record.hash === posHash && record.player === opponent) {
                        repetitionCount++;
                    }
                }
                
                // 如果已经出现过2次，再走这步就是第3次，判犯规
                if (repetitionCount < 2) {
                    safeMoves.push(move);
                }
            } else {
                // 非将军走法总是安全的
                safeMoves.push(move);
            }
            
            this.undoMove(board, undoInfo);
        }
        
        if (safeMoves.length < moves.length) {
            console.log(`🚫 过滤了 ${moves.length - safeMoves.length} 个会导致长将犯规的走法`);
        }
        
        return safeMoves;
    }
    
    /**
     * 生成局面哈希
     */
    getPositionHash(board, player) {
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

    // ==================== 评估体系（核心优化）====================

    /**
     * 主评估函数 - 综合多种评估因素
     */
    evaluate(board, player) {
        const hash = this.zobristHash(board, player);
        const cached = this.evaluationCache.get(hash);
        if (cached !== undefined) return cached;

        let score = 0;
        
        // 1. 子力价值评估（最重要）
        score += this.evaluateMaterial(board, player) * this.config.materialWeight;
        
        // 2. 位置价值评估（精细化）
        score += this.evaluatePosition(board, player) * this.config.positionWeight;
        
        // 3. 兵卒结构评估（单独处理）
        score += this.evaluatePawnStructureAdvanced(board, player) * this.config.pawnStructureWeight;
        
        // 4. 将帅安全评估
        score += this.evaluateKingSafety(board, player) * this.config.kingSafetyWeight;
        
        // 5. 棋子灵活性评估
        score += this.evaluateMobility(board, player) * this.config.mobilityWeight;
        
        // 6. 棋子协调性评估
        score += this.evaluateCoordination(board, player) * this.config.coordinationWeight;
        
        // 7. 威胁评估
        score += this.evaluateThreats(board, player) * this.config.threatWeight;
        
        // 8. 控制中心评估
        score += this.evaluateControl(board, player) * this.config.controlWeight;
        
        // 9. 棋子活跃度评估
        score += this.evaluateActivity(board, player) * this.config.activityWeight;
        
        // 10. 特殊评估：炮架数量、马灵活性等
        score += this.evaluateSpecialFactors(board, player);

        // 根据游戏阶段调整
        score = this.adjustByGamePhase(score, board, player);

        if (this.evaluationCache.size > 100000) this.evaluationCache.clear();
        this.evaluationCache.set(hash, score);
        return score;
    }

    /**
     * 子力价值评估（使用动态价值）
     */
    evaluateMaterial(board, player) {
        let redMaterial = 0, blackMaterial = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                
                // 获取动态子力价值
                let val = this.pieceValues[p.toLowerCase()] || 0;
                
                // 兵卒根据位置调整价值
                if (p.toLowerCase() === 'p') {
                    val = this.getPawnValueByPosition(p, r, c);
                }
                
                if (p === p.toUpperCase()) redMaterial += val;
                else blackMaterial += val;
            }
        }
        
        return player === 'red' ? (redMaterial - blackMaterial) : (blackMaterial - redMaterial);
    }

    /**
     * 根据位置获取兵卒的动态价值
     */
    getPawnValueByPosition(piece, row, col) {
        const isRed = piece === piece.toUpperCase();
        
        // 基础价值
        let baseValue = this.pieceValues[piece.toLowerCase()] || 100;
        
        // 根据位置调整
        if (isRed) {
            // 红方兵
            if (row >= 5) {
                // 未过河
                return baseValue * 0.5;
            } else if (row >= 3) {
                // 过河高兵
                return baseValue * 1.5;
            } else if (row >= 1) {
                // 低兵
                if (row === 1 && col === 4) {
                    // 花心兵 - 价值接近马炮
                    return baseValue * 4;
                }
                return baseValue * 2;
            } else {
                // 底兵
                return baseValue * 0.8;
            }
        } else {
            // 黑方卒
            if (row <= 4) {
                // 未过河
                return baseValue * 0.5;
            } else if (row <= 6) {
                // 过河高卒
                return baseValue * 1.5;
            } else if (row <= 8) {
                // 低卒
                if (row === 8 && col === 4) {
                    // 花心卒
                    return baseValue * 4;
                }
                return baseValue * 2;
            } else {
                // 底卒
                return baseValue * 0.8;
            }
        }
    }

    /**
     * 精细化位置价值评估
     */
    evaluatePosition(board, player) {
        let score = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                
                const isRed = p === p.toUpperCase();
                
                // 兵卒使用专门的位置表
                if (p.toLowerCase() === 'p') {
                    const pawnTable = this.pawnPositionValues[p];
                    if (pawnTable) {
                        const val = pawnTable[r][c] || 0;
                        if (isRed) score += val;
                        else score -= val;
                    }
                } else {
                    // 其他棋子使用通用位置表
                    const table = this.positionTables[p];
                    if (table) {
                        const val = table[r][c] || 0;
                        if (isRed) score += val;
                        else score -= val;
                    }
                }
            }
        }
        
        return player === 'red' ? score : -score;
    }

    /**
     * 高级兵卒结构评估
     */
    evaluatePawnStructureAdvanced(board, player) {
        let score = 0;
        const pawnChar = player === 'red' ? 'P' : 'p';
        const opponentPawn = player === 'red' ? 'p' : 'P';
        const isRed = player === 'red';
        const pawns = [];
        
        // 收集所有己方兵卒
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === pawnChar) pawns.push({r, c});
            }
        }
        
        for (const p of pawns) {
            // 1. 过河奖励
            if (isRed && p.r <= 4) score += 30;
            if (!isRed && p.r >= 5) score += 30;
            
            // 2. 高兵奖励（卒林线以上）
            if (isRed && p.r <= 3) score += 20;
            if (!isRed && p.r >= 6) score += 20;
            
            // 3. 低兵奖励（宫顶线、底二路）
            if (isRed && p.r <= 2) score += 30;
            if (!isRed && p.r >= 7) score += 30;
            
            // 4. 花心兵/卒（九宫中心）- 极高奖励
            if (p.r === (isRed ? 0 : 9) && p.c === 4) score += 150;
            
            // 5. 通路兵检测
            let isPassed = true;
            if (isRed) {
                for (let row = p.r - 1; row >= 0; row--) {
                    if (board[row][p.c] === opponentPawn) {
                        isPassed = false;
                        break;
                    }
                }
            } else {
                for (let row = p.r + 1; row < 10; row++) {
                    if (board[row][p.c] === opponentPawn) {
                        isPassed = false;
                        break;
                    }
                }
            }
            if (isPassed) score += 50;
            
            // 6. 联兵奖励（相邻兵互相保护）
            for (const other of pawns) {
                if (other === p) continue;
                if (Math.abs(other.r - p.r) <= 1 && Math.abs(other.c - p.c) === 1) {
                    score += 25;
                    break;
                }
            }
            
            // 7. 中兵奖励（中路兵价值更高）
            if (p.c === 4) score += 15;
            
            // 8. 三七兵奖励（对活马有重要作用）
            if (p.c === 2 || p.c === 6) score += 10;
        }
        
        return score;
    }

    /**
     * 特殊因素评估（炮架、马灵活性等）
     */
    evaluateSpecialFactors(board, player) {
        let score = 0;
        const isRed = player === 'red';
        
        // 1. 炮架数量评估（影响炮的价值）
        const cannonChar = isRed ? 'C' : 'c';
        const cannons = [];
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === cannonChar) cannons.push({r, c});
            }
        }
        
        for (const cannon of cannons) {
            // 计算炮架数量
            let platforms = 0;
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            
            for (const [dr, dc] of directions) {
                let r = cannon.r + dr;
                let c = cannon.c + dc;
                while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                    if (board[r][c] !== ' ') {
                        platforms++;
                        break;
                    }
                    r += dr;
                    c += dc;
                }
            }
            
            // 炮架越多，炮的价值越高（开局中局）
            // 残局时炮架少，炮的价值下降
            if (this.dynamicParams.gamePhase === 'opening' || 
                this.dynamicParams.gamePhase === 'midgame') {
                score += platforms * 15;
            } else {
                // 残局：炮架少是劣势
                score += (platforms - 2) * 10;
            }
        }
        
        // 2. 马灵活性评估
        const horseChar = isRed ? 'N' : 'n';
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === horseChar) {
                    // 计算马的可走位置数（不考虑被将军）
                    const moves = this.generatePieceMoves(board, r, c, horseChar);
                    const mobility = moves.length;
                    
                    // 马在中心更灵活，在边线被蹩腿概率高
                    const centerBonus = (4 - Math.abs(c - 4)) * 5;
                    
                    // 残局时马的灵活性更重要
                    if (this.dynamicParams.gamePhase === 'endgame') {
                        score += mobility * 8 + centerBonus;
                    } else {
                        score += mobility * 5 + centerBonus;
                    }
                    
                    // 卧槽位、挂角位额外奖励
                    if (isRed) {
                        if (r === 1 && (c === 2 || c === 6)) score += 50; // 卧槽位
                        if (r === 2 && (c === 3 || c === 5)) score += 40; // 挂角位附近
                    } else {
                        if (r === 8 && (c === 2 || c === 6)) score += 50;
                        if (r === 7 && (c === 3 || c === 5)) score += 40;
                    }
                }
            }
        }
        
        // 3. 士象完整度评估
        const advisorChar = isRed ? 'A' : 'a';
        const bishopChar = isRed ? 'B' : 'b';
        let advisorCount = 0;
        let bishopCount = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === advisorChar) advisorCount++;
                if (board[r][c] === bishopChar) bishopCount++;
            }
        }
        
        // 士象完整奖励（中残局更重要）
        if (this.dynamicParams.gamePhase !== 'opening') {
            if (advisorCount === 2) score += 30;
            if (bishopCount === 2) score += 30;
            if (advisorCount === 2 && bishopCount === 2) score += 40; // 士象全额外奖励
        }
        
        // 4. 车路通畅度评估
        const chariotChar = isRed ? 'R' : 'r';
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === chariotChar) {
                    // 计算车的可移动范围
                    let openLines = 0;
                    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                    
                    for (const [dr, dc] of directions) {
                        let steps = 0;
                        let row = r + dr;
                        let col = c + dc;
                        
                        while (row >= 0 && row < 10 && col >= 0 && col < 9) {
                            if (board[row][col] === ' ') {
                                steps++;
                            } else {
                                break;
                            }
                            row += dr;
                            col += dc;
                        }
                        
                        if (steps >= 3) openLines++;
                    }
                    
                    score += openLines * 10;
                    
                    // 车在对方底线奖励
                    if (isRed && r <= 1) score += 30;
                    if (!isRed && r >= 8) score += 30;
                }
            }
        }
        
        return score;
    }

    /**
     * 将帅安全评估（增强版）
     */
    evaluateKingSafety(board, player) {
        const kingChar = player === 'red' ? 'K' : 'k';
        let kingPos = null;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === kingChar) {
                    kingPos = {r, c};
                    break;
                }
            }
        }
        
        if (!kingPos) return -10000;
        
        let safety = 100;
        
        // 被将军惩罚
        if (this.isInCheck(board, player)) safety -= 200;
        
        // 士象守卫奖励
        const advisorChar = player === 'red' ? 'A' : 'a';
        const bishopChar = player === 'red' ? 'B' : 'b';
        let guardCount = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === advisorChar || board[r][c] === bishopChar) {
                    guardCount++;
                }
            }
        }
        
        safety += guardCount * 30;
        
        // 对方子力靠近九宫惩罚
        const opponent = this.getOpponent(player);
        const opponentPieces = this.getMyPieces(board, opponent);
        
        for (const piece of opponentPieces) {
            const dist = Math.abs(piece.row - kingPos.r) + Math.abs(piece.col - kingPos.c);
            if (dist <= 3) {
                const pieceType = piece.type.toLowerCase();
                if (pieceType === 'r') safety -= 30;  // 车靠近威胁大
                if (pieceType === 'c') safety -= 25;  // 炮靠近威胁大
                if (pieceType === 'n') safety -= 20;  // 马靠近威胁大
                if (pieceType === 'p') safety -= 15;  // 兵靠近威胁大
            }
        }
        
        return safety;
    }

    /**
     * 棋子灵活性评估
     */
    evaluateMobility(board, player) {
        let mobility = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ' || this.getPieceColor(p) !== player) continue;
                
                const moves = this.generatePieceMoves(board, r, c, p);
                const pieceType = p.toLowerCase();
                
                // 不同棋子灵活性权重不同
                if (pieceType === 'r') mobility += moves.length * 3;
                else if (pieceType === 'n') mobility += moves.length * 4;
                else if (pieceType === 'c') mobility += moves.length * 3;
                else if (pieceType === 'p') mobility += moves.length * 5; // 兵灵活性更重要
                else mobility += moves.length * 2;
            }
        }
        
        return mobility;
    }

    /**
     * 棋子协调性评估
     */
    evaluateCoordination(board, player) {
        let score = 0;
        const myPieces = [];
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p !== ' ' && this.getPieceColor(p) === player) {
                    myPieces.push({r, c, p: p.toLowerCase()});
                }
            }
        }
        
        for (let i = 0; i < myPieces.length; i++) {
            for (let j = i + 1; j < myPieces.length; j++) {
                const a = myPieces[i], b = myPieces[j];
                
                // 车炮配合
                if ((a.p === 'r' && b.p === 'c') || (a.p === 'c' && b.p === 'r')) {
                    if (a.r === b.r || a.c === b.c) score += 25;
                }
                
                // 双车配合
                if (a.p === 'r' && b.p === 'r') {
                    if (a.r === b.r || a.c === b.c) score += 35;
                }
                
                // 车马配合
                if ((a.p === 'r' && b.p === 'n') || (a.p === 'n' && b.p === 'r')) {
                    const dist = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
                    if (dist <= 3) score += 20;
                }
                
                // 马炮配合
                if ((a.p === 'n' && b.p === 'c') || (a.p === 'c' && b.p === 'n')) {
                    const dist = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
                    if (dist <= 4) score += 15;
                }
                
                // 双马配合
                if (a.p === 'n' && b.p === 'n') {
                    const dist = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
                    if (dist >= 2 && dist <= 4) score += 15;
                }
            }
        }
        
        return score;
    }

    /**
     * 威胁评估
     */
    evaluateThreats(board, player) {
        let score = 0;
        const opponent = this.getOpponent(player);
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const target = board[r][c];
                if (target === ' ') continue;
                
                const targetColor = this.getPieceColor(target);
                if (targetColor !== opponent) continue;
                
                const val = this.pieceValues[target.toLowerCase()] || 0;
                
                // 检查是否有己方棋子可以攻击到此子
                for (let pr = 0; pr < 10; pr++) {
                    for (let pc = 0; pc < 9; pc++) {
                        const attacker = board[pr][pc];
                        if (attacker === ' ' || this.getPieceColor(attacker) !== player) continue;
                        
                        if (this.isValidBasicMove(board, pr, pc, r, c, attacker)) {
                            // 威胁分值 = 被威胁棋子价值的10%
                            score += val * 0.1;
                            
                            // 如果威胁的是高价值棋子，额外加分
                            if (val >= 400) score += 20;
                            break;
                        }
                    }
                }
            }
        }
        
        return score;
    }

    /**
     * 控制中心评估
     */
    evaluateControl(board, player) {
        let score = 0;
        
        // 控制中心点（河界附近和九宫周围）
        const centerPoints = [
            {r: 4, c: 3}, {r: 4, c: 4}, {r: 4, c: 5},
            {r: 5, c: 3}, {r: 5, c: 4}, {r: 5, c: 5}
        ];
        
        for (const point of centerPoints) {
            let redCtrl = 0, blackCtrl = 0;
            
            for (let pr = 0; pr < 10; pr++) {
                for (let pc = 0; pc < 9; pc++) {
                    const piece = board[pr][pc];
                    if (piece === ' ') continue;
                    
                    if (this.isValidBasicMove(board, pr, pc, point.r, point.c, piece)) {
                        if (piece === piece.toUpperCase()) redCtrl++;
                        else blackCtrl++;
                    }
                }
            }
            
            if (player === 'red') score += (redCtrl - blackCtrl) * 3;
            else score += (blackCtrl - redCtrl) * 3;
        }
        
        return score;
    }

    /**
     * 棋子活跃度评估
     */
    evaluateActivity(board, player) {
        let score = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ' || this.getPieceColor(p) !== player) continue;
                
                const moves = this.generatePieceMoves(board, r, c, p);
                const pieceType = p.toLowerCase();
                
                // 不同棋子活跃度权重
                let weight = 3;
                if (pieceType === 'r') weight = 3;
                else if (pieceType === 'n') weight = 4;
                else if (pieceType === 'c') weight = 3;
                else if (pieceType === 'p') weight = 5;
                
                score += moves.length * weight;
            }
        }
        
        return score;
    }

    /**
     * 根据游戏阶段调整评分
     */
    adjustByGamePhase(score, board, player) {
        // 残局：子力价值更重要，给予更高权重
        if (this.dynamicParams.gamePhase === 'endgame') {
            return score * 1.15;
        }
        
        // 中残局过渡
        if (this.dynamicParams.gamePhase === 'late_midgame') {
            return score * 1.08;
        }
        
        // 中局：平衡
        if (this.dynamicParams.gamePhase === 'midgame') {
            return score * 1.0;
        }
        
        // 开局：位置价值更重要
        if (this.dynamicParams.gamePhase === 'opening') {
            return score * 0.95;
        }
        
        return score;
    }

    // ==================== 其余方法保持原有实现 ====================
    
    /**
     * 陷阱走法专用验证
     */
    validateTrapMove(board, trapMove, player) {
        if (!this.validateMoveStrict(board, trapMove, player)) {
            console.warn(`⚠️ 陷阱走法合法性验证失败: ${trapMove.notation}`);
            return false;
        }
        
        const undoInfo = this.makeMove(board, trapMove.from, trapMove.to);
        const isCheckmated = this.isInCheck(board, player) && 
                            this.countLegalMoves(board, player) === 0;
        const materialLoss = this.quickMaterialEvaluation(board, player);
        
        this.undoMove(board, undoInfo);
        
        if (isCheckmated) {
            console.warn(`🚫 陷阱被判定为送杀，已过滤: ${trapMove.notation}`);
            return false;
        }
        
        if (materialLoss < -800) {
            console.warn(`⚠️ 陷阱子力亏损过大(${materialLoss})，放弃: ${trapMove.notation}`);
            return false;
        }
        
        console.log(`✅ 陷阱验证通过: ${trapMove.notation}, 预估亏损: ${materialLoss}`);
        return true;
    }

    /**
     * 快速子力评估
     */
    quickMaterialEvaluation(board, player) {
        let redMaterial = 0, blackMaterial = 0;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                
                let val = this.pieceValues[p.toLowerCase()] || 0;
                
                // 兵卒动态价值
                if (p.toLowerCase() === 'p') {
                    val = this.getPawnValueByPosition(p, r, c);
                }
                
                if (p === p.toUpperCase()) redMaterial += val;
                else blackMaterial += val;
            }
        }
        
        return player === 'red' ? (redMaterial - blackMaterial) : (blackMaterial - redMaterial);
    }

    // ==================== 棋库查询方法（保持原有）====================
    
    findBestBookMoveWithValidation(board, player, moveHistory) {
        if (!this.openingBook) return null;

        // 第一优先级：进攻（利用对手已触发的陷阱）
        if (moveHistory.length > 0) {
            const lastOpponentMove = moveHistory[moveHistory.length - 1];
            const trapResponse = this.findBookTrap(board, player, lastOpponentMove);
            
            if (trapResponse && this.validateTrapMove(board, trapResponse, player)) {
                console.log(`🎯 反击陷阱: ${trapResponse.notation} (${trapResponse.reason || '陷阱反击'})`);
                return {
                    ...trapResponse,
                    source: 'trap_counter',
                    priority: 0,
                    confidence: 'high'
                };
            }
        }

        // 生成候选走法
        const candidates = [];
        
        if (this.config.enableOpeningBook) {
            const openingMove = this.openingBook.getBookMove(board, player, moveHistory);
            if (openingMove) candidates.push({...openingMove, source: 'opening', priority: 1});
        }
        
        if (this.config.enableTacticalMode) {
            const tacticMove = this.findBookTactic(board, player);
            if (tacticMove) candidates.push({...tacticMove, source: 'tactic', priority: 2});
        }
        
        if (this.config.enableEndgameBook && this.dynamicParams.gamePhase === 'endgame') {
            const endgameMove = this.findBookEndgame(board, player);
            if (endgameMove) candidates.push({...endgameMove, source: 'endgame', priority: 3});
        }

        if (this.config.enableMidgameBook && 
            (this.dynamicParams.gamePhase === 'midgame' || this.dynamicParams.gamePhase === 'late_midgame')) {
            const midgameMove = this.findBookMidgame(board, player);
            if (midgameMove) candidates.push({...midgameMove, source: 'midgame', priority: 4});
        }

        if (candidates.length === 0) return null;

        // 验证与过滤
        const validatedMoves = [];
        
        for (const candidate of candidates) {
            if (!this.validateMoveStrict(board, candidate, player)) continue;
            
            const riskInfo = this.assessTrapRisk(board, candidate, player);
            
            if (riskInfo.level === 'high' && !riskInfo.hasCounter) {
                console.warn(`🚫 过滤高风险陷阱走法: ${candidate.notation} (${riskInfo.trapName})`);
                continue;
            }
            
            if (riskInfo.level === 'medium' && riskInfo.hasCounter) {
                candidate.isTacticalBait = true;
                candidate.tacticalValue = (candidate.tacticValue || 0) + 600;
                console.log(`♟️ 允许战术诱饵: ${candidate.notation} (${riskInfo.trapName})`);
            }
            
            const undoInfo = this.makeMove(board, candidate.from, candidate.to);
            const score = this.evaluate(board, player);
            
            if (this.isInCheck(board, player) && this.countLegalMoves(board, player) === 0) {
                this.undoMove(board, undoInfo);
                console.warn(`⚠️ 棋库走法[${candidate.source}]被判定为送杀，已过滤:`, candidate.notation);
                continue;
            }
            
            const engineTopMoves = this.getTopNMoves(board, player, 3, 2);
            const engineMatch = engineTopMoves.find(m => 
                m.from.row === candidate.from.row && 
                m.from.col === candidate.from.col &&
                m.to.row === candidate.to.row &&
                m.to.col === candidate.to.col
            );
            
            this.undoMove(board, undoInfo);
            
            if (engineMatch || candidate.isTacticalBait) {
                candidate.confidence = engineMatch ? 'high' : 'medium';
                candidate.engineScore = engineMatch ? engineMatch.score : score;
                validatedMoves.push(candidate);
            } else {
                const bestEngineScore = engineTopMoves[0]?.score || 0;
                if (score >= bestEngineScore - 800) {
                    candidate.confidence = 'medium';
                    candidate.engineScore = score;
                    validatedMoves.push(candidate);
                } else {
                    console.warn(`⚠️ 棋库走法[${candidate.source}]与引擎分歧过大(${score - bestEngineScore}分)，已过滤:`, candidate.notation);
                }
            }
        }

        if (validatedMoves.length === 0) return null;
        
        validatedMoves.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.isTacticalBait !== b.isTacticalBait) return a.isTacticalBait ? -1 : 1;
            return (b.engineScore || 0) - (a.engineScore || 0);
        });
        
        return validatedMoves[0];
    }

    assessTrapRisk(board, move, player) {
        if (!this.openingBook?.bookData?.traps) {
            return { level: 'none', hasCounter: false, trapName: '' };
        }
        
        const undoInfo = this.makeMove(board, move.from, move.to);
        const opponent = this.getOpponent(player);
        
        let level = 'none';
        let hasCounter = false;
        let trapName = '';
        
        for (const trap of this.openingBook.bookData.traps) {
            if (trap.trapMove && this.matchesTrapTrigger(move, trap, board, opponent)) {
                trapName = trap.name;
                
                const myResponse = this.findBookTrap(board, player, move);
                if (myResponse) {
                    level = 'medium';
                    hasCounter = true;
                } else {
                    level = trap.dangerLevel === 'high' ? 'high' : 'medium';
                    hasCounter = false;
                }
                break;
            }
        }
        
        this.undoMove(board, undoInfo);
        return { level, hasCounter, trapName };
    }

    findBookTrap(board, player, lastMove) {
        if (!this.openingBook || !this.openingBook.bookData || !this.openingBook.bookData.traps) return null;
        
        const traps = this.openingBook.bookData.traps;
        
        for (const trap of traps) {
            if (!this.matchesTrapTrigger(lastMove, trap, board, player)) continue;
            
            if (trap.responseMoves && trap.responseMoves.length > 0) {
                for (const response of trap.responseMoves) {
                    const adaptedMove = this.adaptBookMove(response, board, player);
                    if (adaptedMove && this.validateMoveStrict(board, adaptedMove, player)) {
                        return {
                            ...adaptedMove,
                            weight: 1.2,
                            reason: `陷阱反击: ${trap.name}`
                        };
                    }
                }
            }
        }
        return null;
    }

    matchesTrapTrigger(lastMove, trap, board, player) {
        if (!trap.trapMove) return false;
        
        const exactMatch = 
            lastMove.from.row === trap.trapMove.from.row &&
            lastMove.from.col === trap.trapMove.from.col &&
            lastMove.to.row === trap.trapMove.to.row &&
            lastMove.to.col === trap.trapMove.to.col &&
            lastMove.piece === trap.trapMove.piece;
        
        if (exactMatch) return true;
        
        if (trap.trapMove.allowAnyPiece) {
            const fuzzyMatch = 
                lastMove.to.row === trap.trapMove.to.row &&
                lastMove.to.col === trap.trapMove.to.col;
            if (fuzzyMatch) {
                console.log(`🎭 模糊匹配陷阱: ${trap.name}`);
                return true;
            }
        }
        
        return false;
    }

    findBookTactic(board, player) {
        if (!this.openingBook || !this.openingBook.bookData || !this.openingBook.bookData.tactics) return null;
        
        const tactics = this.openingBook.bookData.tactics;
        const legalTactics = [];
        
        for (const tactic of tactics) {
            if (!tactic.solution || tactic.solution.length === 0) continue;
            
            const intention = tactic.solution[0];
            let move = null;
            
            switch(intention.type) {
                case 'horse_fork':
                    move = this.findHorseForkMove(board, player, intention.targetTypes);
                    break;
                case 'chariot_check_capture':
                    move = this.findChariotCheckCapture(board, player);
                    break;
                case 'horse_cannon_mate':
                    move = this.findHorseCannonMate(board, player);
                    break;
                case 'discovered_check':
                    move = this.findDiscoveredCheck(board, player);
                    break;
                case 'double_check':
                    move = this.findDoubleCheck(board, player);
                    break;
                case 'clearance':
                    move = this.findClearanceSacrifice(board, player);
                    break;
                case 'deflection':
                    move = this.findDeflection(board, player);
                    break;
                default:
                    if (intention.from && intention.to) {
                        move = intention;
                    }
            }
            
            if (move && this.validateMoveStrict(board, move, player)) {
                legalTactics.push({
                    ...move,
                    weight: (tactic.reward || 1000) / 2000,
                    reason: `战术: ${tactic.name}`
                });
            }
        }
        
        if (legalTactics.length === 0) return null;
        legalTactics.sort((a, b) => b.weight - a.weight);
        return legalTactics[0];
    }

    findBookEndgame(board, player) {
        if (!this.openingBook || !this.openingBook.bookData || !this.openingBook.bookData.endgames) return null;
        
        const endgames = this.openingBook.bookData.endgames;
        
        for (const pattern of endgames) {
            if (!pattern.suggestedMoves || pattern.suggestedMoves.length === 0) continue;
            
            if (this.openingBook.matchPositionFeatures && 
                this.openingBook.matchPositionFeatures(board, pattern.keyFeatures, player)) {
                
                for (const move of pattern.suggestedMoves) {
                    const adaptedMove = this.adaptBookMove(move, board, player);
                    if (adaptedMove && this.validateMoveStrict(board, adaptedMove, player)) {
                        return {
                            ...adaptedMove,
                            weight: pattern.weight || 0.95,
                            reason: `残局定式: ${pattern.name}`,
                            endgameType: pattern.winningMethod || 'standard'
                        };
                    }
                }
            }
        }
        return null;
    }

    findBookMidgame(board, player) {
        if (!this.openingBook || !this.openingBook.bookData || !this.openingBook.bookData.midgames) return null;
        
        const midgames = this.openingBook.bookData.midgames;
        
        for (const pattern of midgames) {
            if (!pattern.suggestedMoves || pattern.suggestedMoves.length === 0) continue;
            
            if (this.openingBook.matchMidgamePattern && 
                this.openingBook.matchMidgamePattern(board, pattern, player)) {
                
                for (const move of pattern.suggestedMoves) {
                    const adaptedMove = this.adaptBookMove(move, board, player);
                    if (adaptedMove && this.validateMoveStrict(board, adaptedMove, player)) {
                        return {
                            ...adaptedMove,
                            weight: pattern.weight || 0.85,
                            reason: `中局模式: ${pattern.name}`
                        };
                    }
                }
            }
        }
        return null;
    }

    // ==================== 战术意图生成方法 ====================

    findHorseForkMove(board, player, targetTypes) {
        const myPieces = this.getMyPieces(board, player);
        const horses = myPieces.filter(p => p.type.toLowerCase() === 'n');
        const opponent = this.getOpponent(player);
        
        for (const horse of horses) {
            const moves = this.generatePieceMoves(board, horse.row, horse.col, horse.piece);
            for (const to of moves) {
                const undo = this.makeMove(board, {row: horse.row, col: horse.col}, to);
                let captureCount = 0;
                let capturedValues = [];
                
                const enemyPieces = this.getMyPieces(board, opponent);
                for (const enemy of enemyPieces) {
                    if (this.isValidBasicMove(board, to.row, to.col, enemy.row, enemy.col, horse.piece)) {
                        const val = this.pieceValues[enemy.type.toLowerCase()] || 0;
                        if (val >= (targetTypes ? 400 : 200)) {
                            captureCount++;
                            capturedValues.push(val);
                        }
                    }
                }
                
                this.undoMove(board, undo);
                
                if (captureCount >= 2) {
                    return {
                        from: { row: horse.row, col: horse.col },
                        to: to,
                        piece: horse.piece,
                        notation: `马${this.colToChinese(horse.col)}${this.colToChinese(to.col)}`,
                        isCapture: board[to.row][to.col] !== ' ',
                        tacticValue: capturedValues.reduce((a,b) => a+b, 0)
                    };
                }
            }
        }
        return null;
    }

    findChariotCheckCapture(board, player) {
        const myPieces = this.getMyPieces(board, player);
        const chariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
        const opponent = this.getOpponent(player);
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return null;
        
        for (const chariot of chariots) {
            const moves = this.generatePieceMoves(board, chariot.row, chariot.col, chariot.piece);
            for (const to of moves) {
                const target = board[to.row][to.col];
                if (target === ' ') continue;
                
                const undo = this.makeMove(board, {row: chariot.row, col: chariot.col}, to);
                const givesCheck = this.isInCheck(board, opponent);
                const isSafe = !this.isInCheck(board, player);
                this.undoMove(board, undo);
                
                if (givesCheck && isSafe) {
                    const targetVal = this.pieceValues[target.toLowerCase()] || 0;
                    return {
                        from: { row: chariot.row, col: chariot.col },
                        to: to,
                        piece: chariot.piece,
                        notation: `车${this.colToChinese(chariot.col)}${this.colToChinese(to.col)}`,
                        isCapture: true,
                        tacticValue: targetVal + 500
                    };
                }
            }
        }
        return null;
    }

    findHorseCannonMate(board, player) {
        const myPieces = this.getMyPieces(board, player);
        const horses = myPieces.filter(p => p.type.toLowerCase() === 'n');
        const cannons = myPieces.filter(p => p.type.toLowerCase() === 'c');
        const opponent = this.getOpponent(player);
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing || cannons.length === 0) return null;
        
        for (const horse of horses) {
            const targetRows = opponent === 'black' ? [enemyKing.row - 1, enemyKing.row + 1] : [enemyKing.row + 1, enemyKing.row - 1];
            for (const tr of targetRows) {
                for (const tc of [enemyKing.col - 1, enemyKing.col + 1]) {
                    if (tr < 0 || tr > 9 || tc < 0 || tc > 8) continue;
                    if (this.isValidBasicMove(board, horse.row, horse.col, tr, tc, horse.piece)) {
                        for (const cannon of cannons) {
                            if (cannon.row === tr || cannon.col === enemyKing.col) {
                                const undo = this.makeMove(board, {row: horse.row, col: horse.col}, {row: tr, col: tc});
                                const isMate = this.isInCheck(board, opponent) && this.countLegalMoves(board, opponent) === 0;
                                this.undoMove(board, undo);
                                
                                if (isMate || this.isInCheck(board, opponent)) {
                                    return {
                                        from: { row: horse.row, col: horse.col },
                                        to: { row: tr, col: tc },
                                        piece: horse.piece,
                                        notation: `马${this.colToChinese(horse.col)}${this.colToChinese(tc)}`,
                                        isCapture: board[tr][tc] !== ' '
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    findDiscoveredCheck(board, player) {
        const myPieces = this.getMyPieces(board, player);
        const opponent = this.getOpponent(player);
        
        for (const piece of myPieces) {
            if (piece.type.toLowerCase() !== 'r' && piece.type.toLowerCase() !== 'c') continue;
            
            const directions = [[-1,0],[1,0],[0,-1],[0,1]];
            for (const [dr, dc] of directions) {
                let r = piece.row + dr, c = piece.col + dc;
                let blocker = null;
                
                while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                    if (board[r][c] !== ' ') {
                        blocker = {row: r, col: c, piece: board[r][c]};
                        break;
                    }
                    r += dr;
                    c += dc;
                }
                
                if (blocker) {
                    const blockerColor = blocker.piece === blocker.piece.toUpperCase() ? 'red' : 'black';
                    if (blockerColor === player) {
                        const blockerMoves = this.generatePieceMoves(board, blocker.row, blocker.col, blocker.piece);
                        for (const to of blockerMoves) {
                            const undo = this.makeMove(board, {row: blocker.row, col: blocker.col}, to);
                            const givesCheck = this.isInCheck(board, opponent);
                            const isSafe = !this.isInCheck(board, player);
                            this.undoMove(board, undo);
                            
                            if (givesCheck && isSafe) {
                                return {
                                    from: { row: blocker.row, col: blocker.col },
                                    to: to,
                                    piece: blocker.piece,
                                    notation: `${PIECE_CHARS[blocker.piece]}${this.colToChinese(blocker.col)}${this.colToChinese(to.col)}`,
                                    isCapture: board[to.row][to.col] !== ' '
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    findDoubleCheck(board, player) {
        const myPieces = this.getMyPieces(board, player);
        const opponent = this.getOpponent(player);
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return null;
        
        for (const piece of myPieces) {
            const moves = this.generateAllMovesForPiece(board, piece.row, piece.col, piece.piece);
            for (const move of moves) {
                const undo = this.makeMove(board, move.from, move.to);
                const attackers = this.countAttackingPieces(board, enemyKing, player);
                this.undoMove(board, undo);
                
                if (attackers >= 2) {
                    return {
                        from: move.from,
                        to: move.to,
                        piece: piece.piece,
                        notation: this.generateNotation(piece.piece, piece.row, piece.col, move.to.row, move.to.col),
                        tacticType: 'double_check'
                    };
                }
            }
        }
        return null;
    }

    countAttackingPieces(board, kingPos, player) {
        let count = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === ' ') continue;
                const piecePlayer = piece === piece.toUpperCase() ? 'red' : 'black';
                if (piecePlayer !== player) continue;
                if (this.isValidBasicMove(board, r, c, kingPos.row, kingPos.col, piece)) {
                    count++;
                }
            }
        }
        return count;
    }

    findClearanceSacrifice(board, player) {
        const myPieces = this.getMyPieces(board, player);
        const pawns = myPieces.filter(p => p.type.toLowerCase() === 'p');
        const chariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
        
        if (chariots.length === 0) return null;
        
        for (const pawn of pawns) {
            for (const chariot of chariots) {
                if (pawn.row === chariot.row) {
                    const moves = this.generatePieceMoves(board, pawn.row, pawn.col, pawn.piece);
                    for (const to of moves) {
                        if (to.row === chariot.row && Math.abs(to.col - chariot.col) === 1) {
                            return {
                                from: { row: pawn.row, col: pawn.col },
                                to: to,
                                piece: pawn.piece,
                                notation: `兵${this.colToChinese(pawn.col)}${this.colToChinese(to.col)}`,
                                isCapture: board[to.row][to.col] !== ' '
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    findDeflection(board, player) {
        const opponent = this.getOpponent(player);
        const myPieces = this.getMyPieces(board, player);
        
        for (const piece of myPieces) {
            const moves = this.generateAllMovesForPiece(board, piece.row, piece.col, piece.piece);
            for (const move of moves) {
                const target = board[move.to.row][move.to.col];
                if (target === ' ') continue;
                
                const targetType = target.toLowerCase();
                if (targetType === 'a' || targetType === 'b') {
                    const undo = this.makeMove(board, move.from, move.to);
                    const improvesAttack = this.evaluateAttackPotential(board, player) > 100;
                    this.undoMove(board, undo);
                    
                    if (improvesAttack) {
                        return {
                            from: move.from,
                            to: move.to,
                            piece: piece.piece,
                            notation: this.generateNotation(piece.piece, piece.row, piece.col, move.to.row, move.to.col),
                            isCapture: true
                        };
                    }
                }
            }
        }
        return null;
    }

    // ==================== 走法适配与验证 ====================

    adaptBookMove(bookMove, board, player) {
        if (!bookMove || !bookMove.from || !bookMove.to) return null;
        
        const piece = bookMove.piece;
        const isRedPiece = piece === piece.toUpperCase();
        const piecePlayer = isRedPiece ? 'red' : 'black';
        
        if (piecePlayer !== player) return null;
        
        if (board[bookMove.from.row][bookMove.from.col] === piece) {
            const targetPiece = board[bookMove.to.row][bookMove.to.col];
            const expectedCapture = bookMove.notation?.includes('吃') || bookMove.isCapture;
            
            if (expectedCapture && targetPiece === ' ') {
                return this.findAlternativeTarget(bookMove, board, player) || {
                    from: { ...bookMove.from },
                    to: { ...bookMove.to },
                    piece: piece,
                    notation: bookMove.notation,
                    isCapture: false
                };
            }
            
            return {
                from: { ...bookMove.from },
                to: { ...bookMove.to },
                piece: piece,
                notation: bookMove.notation,
                isCapture: targetPiece !== ' '
            };
        }
        
        const intention = this.parseMoveIntention(bookMove, player);
        if (!intention) return null;
        
        return this.findMoveForIntention(intention, board, player);
    }

    parseMoveIntention(bookMove, player) {
        const piece = bookMove.piece.toLowerCase();
        const isRed = bookMove.piece === bookMove.piece.toUpperCase();
        const from = bookMove.from;
        const to = bookMove.to;
        
        if ((piece === 'r' || piece === 'c') && Math.abs(to.row - from.row) > 2) {
            return {
                type: 'cross_river',
                pieceType: piece,
                isRed: isRed,
                preference: 'forward'
            };
        }
        
        if (piece === 'n' && Math.abs(to.col - 4) <= 1 && Math.abs(to.row - from.row) === 2) {
            return {
                type: 'horse_tactics',
                pieceType: 'n',
                targetCol: to.col
            };
        }
        
        return {
            type: 'relative_shift',
            pieceType: piece,
            rowDelta: to.row - from.row,
            colDelta: to.col - from.col
        };
    }

    findMoveForIntention(intention, board, player) {
        const pieceChar = intention.pieceType;
        const myPiece = player === 'red' ? pieceChar.toUpperCase() : pieceChar;
        
        const candidates = [];
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] !== myPiece) continue;
                
                const moves = this.generatePieceMoves(board, r, c, myPiece);
                
                for (const to of moves) {
                    if (this.satisfiesIntention({row: r, col: c}, to, intention, player)) {
                        candidates.push({
                            from: {row: r, col: c},
                            to: to,
                            piece: myPiece,
                            notation: this.generateNotation(myPiece, r, c, to.row, to.col),
                            isCapture: board[to.row][to.col] !== ' '
                        });
                    }
                }
            }
        }
        
        if (candidates.length === 0) return null;
        
        if (intention.type === 'cross_river') {
            return player === 'red' 
                ? candidates.reduce((best, cur) => cur.from.row < best.from.row ? cur : best)
                : candidates.reduce((best, cur) => cur.from.row > best.from.row ? cur : best);
        }
        
        return candidates[0];
    }

    satisfiesIntention(from, to, intention, player) {
        switch (intention.type) {
            case 'cross_river':
                if (player === 'red') return to.row <= 4;
                return to.row >= 5;
            case 'relative_shift':
                return (to.row - from.row === intention.rowDelta) &&
                       (to.col - from.col === intention.colDelta);
            default:
                return true;
        }
    }

    findAlternativeTarget(bookMove, board, player) {
        return null;
    }

    generateNotation(piece, fromRow, fromCol, toRow, toCol) {
        const pieceNames = {'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒'};
        const name = pieceNames[piece.toLowerCase()] || piece;
        return `${name}${fromCol}${fromRow}->${toCol}${toRow}`;
    }

    colToChinese(col) {
        const chars = ['九','八','七','六','五','四','三','二','一'];
        return chars[col] || col;
    }

    // ==================== 严格走法验证 ====================

    validateMoveStrict(board, move, player) {
        if (!move || !move.from || !move.to) return false;
        
        const { from, to, piece } = move;
        
        if (!this.isValidCoord(from.row, from.col) || !this.isValidCoord(to.row, to.col)) return false;
        
        const actualPiece = board[from.row][from.col];
        if (actualPiece === ' ' || actualPiece !== piece) return false;
        
        const isRedPiece = piece === piece.toUpperCase();
        if ((player === 'red' && !isRedPiece) || (player === 'black' && isRedPiece)) return false;
        
        const target = board[to.row][to.col];
        if (target !== ' ') {
            const isTargetRed = target === target.toUpperCase();
            if (isRedPiece === isTargetRed) return false;
        }
        
        if (!this.isValidBasicMove(board, from.row, from.col, to.row, to.col, piece)) return false;
        
        if (this.wouldBeInCheck(board, from, to, player)) return false;
        
        if (this.wouldCauseKingsFace(board, from, to)) return false;
        
        return true;
    }

    isValidCoord(row, col) {
        return row >= 0 && row < 10 && col >= 0 && col < 9;
    }

    wouldCauseKingsFace(board, from, to) {
        const piece = board[from.row][from.col];
        const target = board[to.row][to.col];
        
        board[to.row][to.col] = piece;
        board[from.row][from.col] = ' ';
        
        const facing = this.areKingsFacing(board);
        
        board[from.row][from.col] = piece;
        board[to.row][to.col] = target;
        
        return facing;
    }

    // ==================== PVS搜索 ====================

    pvsSearch(board, depth, alpha, beta, player, lastMove, ply) {
        this.stats.nodesSearched++;

        if (ply > 60 || this.shouldStopSearch(ply)) {
            return this.quiescenceSearch(board, alpha, beta, player, 0);
        }

        if (depth <= 0) {
            return this.quiescenceSearch(board, alpha, beta, player, 0);
        }

        const hash = this.zobristHash(board, player);
        const ttEntry = this.transpositionTable.get(hash);
        if (ttEntry && ttEntry.depth >= depth && ttEntry.flag) {
            if (this.verifyTTEntry(board, ttEntry, player)) {
                this.stats.transpositionHits++;
                if (ttEntry.flag === 'EXACT') return ttEntry.score;
                if (ttEntry.flag === 'LOWER') alpha = Math.max(alpha, ttEntry.score);
                if (ttEntry.flag === 'UPPER') beta = Math.min(beta, ttEntry.score);
                if (alpha >= beta) return ttEntry.score;
            }
        }

        if (this.config.enableNullMove && depth >= 3 && !this.isInCheck(board, player) && this.dynamicParams.phaseFactor > 0.3) {
            const R = this.config.nullMoveDepthReduction + (depth > 6 ? 1 : 0);
            const nullScore = -this.pvsSearch(board, depth - 1 - R, -beta, -beta + 1,
                this.getOpponent(player), null, ply + 1);

            if (nullScore >= beta) {
                this.stats.nullMovePrunes++;
                return beta;
            }
        }

        const moves = this.generateAllMoves(board, player);
        if (moves.length === 0) {
            return this.isInCheck(board, player) ? -1000000 + ply : 0;
        }

        const sortedMoves = this.orderMoves(board, moves, player, lastMove, ply, depth);
        
        let bestScore = -Infinity;
        let bestMove = null;
        let flag = 'UPPER';

        for (let i = 0; i < sortedMoves.length; i++) {
            const move = sortedMoves[i];
            
            if (!this.validateMoveStrict(board, move, player)) continue;
            
            const undoInfo = this.makeMove(board, move.from, move.to);
            
            if (this.illegalPosition(board) || this.isInCheck(board, player)) {
                this.undoMove(board, undoInfo);
                continue;
            }

            let reduction = 0;
            if (this.config.enableLMR && i >= this.config.lmrMoveThreshold && depth >= this.config.lmrBaseDepth &&
                !move.isCapture && !this.isInCheck(board, this.getOpponent(player))) {
                reduction = Math.floor(Math.log(i + 1) / Math.log(this.config.lmrLogBase));
                reduction = Math.min(reduction, depth - 1);
                this.stats.lmReductions++;
            }

            let score;
            if (i === 0) {
                score = -this.pvsSearch(board, depth - 1 + reduction, -beta, -alpha,
                    this.getOpponent(player), move, ply + 1);
            } else {
                score = -this.pvsSearch(board, depth - 1 - reduction, -alpha - 1, -alpha,
                    this.getOpponent(player), move, ply + 1);
                
                if (score > alpha && (reduction > 0 || score < beta)) {
                    score = -this.pvsSearch(board, depth - 1, -beta, -alpha,
                        this.getOpponent(player), move, ply + 1);
                }
            }

            this.undoMove(board, undoInfo);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;

                if (score > alpha) {
                    alpha = score;
                    flag = 'EXACT';

                    if (alpha >= beta) {
                        flag = 'LOWER';
                        this.stats.cutoffs++;
                        if (!move.isCapture) {
                            this.updateKiller(move, ply, score);
                            this.updateHistory(move, depth);
                        }
                        break;
                    }
                }
            }
        }

        if (this.config.enableTransposition && bestMove) {
            if (this.transpositionTable.size > 1000000) this.cleanTranspositionTable();
            this.transpositionTable.set(hash, {
                score: bestScore, depth: depth, flag: flag, bestMove: bestMove, age: ply
            });
        }

        return bestScore;
    }

    // ==================== 静态搜索 ====================

    quiescenceSearch(board, alpha, beta, player, depth) {
        this.stats.qNodesSearched++;

        const standPat = this.evaluate(board, player);

        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        if (standPat + this.config.deltaMargin < alpha) {
            this.stats.deltaPrunes++;
            return alpha;
        }

        if (depth > 6) return alpha;

        const captureMoves = this.generateCaptureMoves(board, player);
        const sortedCaptures = this.orderCaptures(board, captureMoves);

        for (const move of sortedCaptures) {
            if (!this.validateMoveStrict(board, move, player)) continue;
            
            const seeScore = this.quickSEE(board, move);
            if (seeScore < -200) continue;
            if (standPat + seeScore + 200 < alpha) continue;

            const undoInfo = this.makeMove(board, move.from, move.to);
            
            if (this.illegalPosition(board) || this.isInCheck(board, player)) {
                this.undoMove(board, undoInfo);
                continue;
            }

            const score = -this.quiescenceSearch(board, -beta, -alpha, this.getOpponent(player), depth + 1);
            this.undoMove(board, undoInfo);

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    // ==================== 基础工具方法 ====================

    isValidBasicMove(board, fromRow, fromCol, toRow, toCol, piece) {
        const pieceType = piece.toLowerCase();
        const isRed = piece === piece.toUpperCase();
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        switch (pieceType) {
            case 'k':
                const palaceRows = isRed ? [7, 8, 9] : [0, 1, 2];
                if (!palaceRows.includes(toRow) || toCol < 3 || toCol > 5) return false;
                return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
            
            case 'a':
                const advisorRows = isRed ? [7, 8, 9] : [0, 1, 2];
                if (!advisorRows.includes(toRow) || toCol < 3 || toCol > 5) return false;
                return rowDiff === 1 && colDiff === 1;
            
            case 'b':
                if (rowDiff !== 2 || colDiff !== 2) return false;
                if (isRed && toRow < 5) return false;
                if (!isRed && toRow > 4) return false;
                const eyeRow = (fromRow + toRow) / 2;
                const eyeCol = (fromCol + toCol) / 2;
                return board[eyeRow][eyeCol] === ' ';
            
            case 'n':
                if (!((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2))) return false;
                const legRow = rowDiff === 2 ? (fromRow + toRow) / 2 : fromRow;
                const legCol = colDiff === 2 ? (fromCol + toCol) / 2 : fromCol;
                return board[legRow][legCol] === ' ';
            
            case 'r':
                if (rowDiff !== 0 && colDiff !== 0) return false;
                const rStepRow = rowDiff === 0 ? 0 : (toRow > fromRow ? 1 : -1);
                const rStepCol = colDiff === 0 ? 0 : (toCol > fromCol ? 1 : -1);
                let r = fromRow + rStepRow, c = fromCol + rStepCol;
                while (r !== toRow || c !== toCol) {
                    if (board[r][c] !== ' ') return false;
                    r += rStepRow; c += rStepCol;
                }
                return true;
            
            case 'c':
                if (rowDiff !== 0 && colDiff !== 0) return false;
                const cStepRow = rowDiff === 0 ? 0 : (toRow > fromRow ? 1 : -1);
                const cStepCol = colDiff === 0 ? 0 : (toCol > fromCol ? 1 : -1);
                let piecesBetween = 0;
                let cr = fromRow + cStepRow, cc = fromCol + cStepCol;
                while (cr !== toRow || cc !== toCol) {
                    if (board[cr][cc] !== ' ') piecesBetween++;
                    cr += cStepRow; cc += cStepCol;
                }
                const target = board[toRow][toCol];
                if (target === ' ') return piecesBetween === 0;
                return piecesBetween === 1;
            
            case 'p':
                if (isRed) {
                    if (toRow === fromRow - 1 && toCol === fromCol) return true;
                    if (fromRow < 5 && toRow === fromRow && Math.abs(toCol - fromCol) === 1) return true;
                } else {
                    if (toRow === fromRow + 1 && toCol === fromCol) return true;
                    if (fromRow > 4 && toRow === fromRow && Math.abs(toCol - fromCol) === 1) return true;
                }
                return false;
        }
        return false;
    }

    areKingsFacing(board) {
        let redKing = null, blackKing = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 'K') redKing = {r, c};
                if (board[r][c] === 'k') blackKing = {r, c};
            }
        }
        if (!redKing || !blackKing || redKing.c !== blackKing.c) return false;
        
        const start = Math.min(redKing.r, blackKing.r) + 1;
        const end = Math.max(redKing.r, blackKing.r);
        for (let r = start; r < end; r++) {
            if (board[r][redKing.c] !== ' ') return false;
        }
        return true;
    }

    isInCheck(board, player) {
        const kingChar = player === 'red' ? 'K' : 'k';
        let kingPos = null;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === kingChar) {
                    kingPos = {row: r, col: c};
                    break;
                }
            }
            if (kingPos) break;
        }
        
        if (!kingPos) return true;
        
        const opponent = this.getOpponent(player);
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === ' ') continue;
                const pieceColor = piece === piece.toUpperCase() ? 'red' : 'black';
                if (pieceColor !== opponent) continue;
                
                if (this.isValidBasicMove(board, r, c, kingPos.row, kingPos.col, piece)) {
                    return true;
                }
            }
        }
        return false;
    }

    isCheckmate(board, player) {
        if (!this.isInCheck(board, player)) {
            return false;
        }
        
        const moves = this.generateAllMoves(board, player);
        for (const move of moves) {
            if (this.validateMoveStrict(board, move, player)) {
                const undoInfo = this.makeMove(board, move.from, move.to);
                const stillInCheck = this.isInCheck(board, player);
                const facing = this.areKingsFacing(board);
                this.undoMove(board, undoInfo);
                
                if (!stillInCheck && !facing) {
                    return false;
                }
            }
        }
        
        return true;
    }

    countLegalMoves(board, player) {
        let count = 0;
        const moves = this.generateAllMoves(board, player);
        for (const move of moves) {
            if (this.validateMoveStrict(board, move, player)) {
                count++;
            }
        }
        return count;
    }

    wouldBeInCheck(board, from, to, player) {
        const piece = board[from.row][from.col];
        const target = board[to.row][to.col];
        
        board[to.row][to.col] = piece;
        board[from.row][from.col] = ' ';
        
        const inCheck = this.isInCheck(board, player);
        
        board[from.row][from.col] = piece;
        board[to.row][to.col] = target;
        
        return inCheck;
    }

    wouldGiveCheck(board, from, to, player) {
        const piece = board[from.row][from.col];
        const target = board[to.row][to.col];
        
        board[to.row][to.col] = piece;
        board[from.row][from.col] = ' ';
        
        const givesCheck = this.isInCheck(board, this.getOpponent(player));
        
        board[from.row][from.col] = piece;
        board[to.row][to.col] = target;
        
        return givesCheck;
    }

    illegalPosition(board) {
        return this.areKingsFacing(board);
    }

    // ==================== 走法生成 ====================

    generateAllMoves(board, player) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (piece === ' ') continue;
                
                const pieceColor = piece === piece.toUpperCase() ? 'red' : 'black';
                if (pieceColor !== player) continue;
                
                const pieceMoves = this.generatePieceMoves(board, r, c, piece);
                pieceMoves.forEach(to => {
                    const target = board[to.row][to.col];
                    moves.push({
                        from: {row: r, col: c},
                        to: to,
                        piece: piece,
                        target: target,
                        isCapture: target !== ' ',
                        pieceType: piece.toLowerCase(),
                        targetType: target !== ' ' ? target.toLowerCase() : '',
                        value: 0,
                        givesCheck: false,
                        isQuiet: target === ' '
                    });
                });
            }
        }
        return moves;
    }

    generatePieceMoves(board, row, col, piece) {
        const moves = [];
        const pieceType = piece.toLowerCase();
        const isRed = piece === piece.toUpperCase();
        
        const directions = {
            'k': [[-1,0],[1,0],[0,-1],[0,1]],
            'a': [[-1,-1],[-1,1],[1,-1],[1,1]],
            'b': [[-2,-2],[-2,2],[2,-2],[2,2]],
            'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
            'r': [[-1,0],[1,0],[0,-1],[0,1]],
            'c': [[-1,0],[1,0],[0,-1],[0,1]],
            'p': []
        };
        
        if (pieceType === 'p') {
            if (isRed) {
                directions.p = [[-1,0]];
                if (row <= 4) directions.p.push([0,-1], [0,1]);
            } else {
                directions.p = [[1,0]];
                if (row >= 5) directions.p.push([0,-1], [0,1]);
            }
        }
        
        const dirs = directions[pieceType] || [];
        
        for (const [dr, dc] of dirs) {
            if (pieceType === 'r' || pieceType === 'c') {
                let step = 1;
                while (true) {
                    const nr = row + dr * step, nc = col + dc * step;
                    if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) break;
                    
                    const target = board[nr][nc];
                    if (target === ' ') {
                        moves.push({row: nr, col: nc});
                    } else {
                        if (pieceType === 'r') {
                            if ((piece === piece.toUpperCase()) !== (target === target.toUpperCase())) 
                                moves.push({row: nr, col: nc});
                            break;
                        } else {
                            step++;
                            while (true) {
                                const nr2 = row + dr * step, nc2 = col + dc * step;
                                if (nr2 < 0 || nr2 >= 10 || nc2 < 0 || nc2 >= 9) break;
                                const t2 = board[nr2][nc2];
                                if (t2 !== ' ') {
                                    if ((piece === piece.toUpperCase()) !== (t2 === t2.toUpperCase())) 
                                        moves.push({row: nr2, col: nc2});
                                    break;
                                }
                                step++;
                            }
                            break;
                        }
                    }
                    step++;
                }
            } else {
                const nr = row + dr, nc = col + dc;
                if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    const target = board[nr][nc];
                    if (target === ' ' || (piece === piece.toUpperCase()) !== (target === target.toUpperCase())) {
                        if (this.isValidBasicMove(board, row, col, nr, nc, piece)) {
                            moves.push({row: nr, col: nc});
                        }
                    }
                }
            }
        }
        return moves;
    }

    generateCaptureMoves(board, player) {
        const all = this.generateAllMoves(board, player);
        return all.filter(m => m.isCapture);
    }

    getOpponent(player) {
        return player === 'red' ? 'black' : 'red';
    }

    getPieceColor(piece) {
        return piece === piece.toUpperCase() ? 'red' : 'black';
    }

    // ==================== 撤销走法系统 ====================

    makeMove(board, from, to) {
        const undoInfo = {
            fromRow: from.row, fromCol: from.col,
            toRow: to.row, toCol: to.col,
            fromPiece: board[from.row][from.col],
            toPiece: board[to.row][to.col]
        };
        const piece = board[from.row][from.col];
        board[to.row][to.col] = piece;
        board[from.row][from.col] = ' ';
        return undoInfo;
    }

    undoMove(board, undoInfo) {
        board[undoInfo.fromRow][undoInfo.fromCol] = undoInfo.fromPiece;
        board[undoInfo.toRow][undoInfo.toCol] = undoInfo.toPiece;
    }

    // ==================== 哈希系统 ====================

    initZobristKeys() {
        return {
            pieces: new Array(10).fill().map(() => 
                new Array(9).fill().map(() => 
                    new Array(14).fill().map(() => Math.floor(Math.random() * 2**32))
                )
            ),
            side: Math.floor(Math.random() * 2**32)
        };
    }

    zobristHash(board, player) {
        let hash = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                const idx = this.getPieceIndex(p);
                if (idx >= 0) hash ^= this.zobristKeys.pieces[r][c][idx];
            }
        }
        if (player === 'red') hash ^= this.zobristKeys.side;
        return hash;
    }

    getPieceIndex(piece) {
        const pieces = ['r','n','b','a','k','c','p','R','N','B','A','K','C','P'];
        return pieces.indexOf(piece);
    }

    verifyTTEntry(board, entry, player) {
        return entry && ['EXACT','LOWER','UPPER'].includes(entry.flag);
    }

    cleanTranspositionTable() {
        if (this.transpositionTable.size > 800000) {
            const entries = Array.from(this.transpositionTable.entries());
            entries.sort((a, b) => b[1].depth - a[1].depth);
            this.transpositionTable.clear();
            for (let i = 0; i < Math.min(400000, entries.length); i++) {
                this.transpositionTable.set(entries[i][0], entries[i][1]);
            }
        }
    }

    // ==================== 启发式更新与排序 ====================

    updateHistory(move, depth) {
        const idx = move.from.row * 9 * 10 * 9 + move.from.col * 10 * 9 + move.to.row * 9 + move.to.col;
        const bonus = depth * depth;
        this.historyTable[idx] = (this.historyTable[idx] || 0) + bonus;
        if (this.historyTable[idx] > 1000000) this.historyTable[idx] = Math.floor(this.historyTable[idx] / 2);
    }

    updateKiller(move, ply, score) {
        if (ply >= this.killerMoves.length) return;
        const killers = this.killerMoves[ply];
        for (let i = 0; i < killers.length; i++) {
            if (this.movesEqual(move, killers[i])) {
                killers[i].score = Math.max(killers[i].score, score);
                return;
            }
        }
        let minIdx = 0;
        for (let i = 1; i < killers.length; i++) {
            if (killers[i].score < killers[minIdx].score) minIdx = i;
        }
        if (score > killers[minIdx].score) {
            killers[minIdx] = { from: {...move.from}, to: {...move.to}, score };
        }
    }

    orderMoves(board, moves, player, lastMove, ply, depth) {
        const moveScores = new Map();
        const hash = this.zobristHash(board, player);
        const ttEntry = this.transpositionTable.get(hash);
        const ttMove = ttEntry ? ttEntry.bestMove : null;

        for (const move of moves) {
            let score = 0;

            if (ttMove && this.movesEqual(move, ttMove)) score += 15000;

            const killers = this.killerMoves[ply] || [];
            if (killers[0] && this.movesEqual(move, killers[0])) score += 10000;
            if (killers[1] && this.movesEqual(move, killers[1])) score += 9000;

            if (move.isCapture) {
                const victimVal = this.pieceValues[move.targetType] || 0;
                const attackerVal = this.pieceValues[move.pieceType] || 0;
                score += victimVal * 10 - attackerVal;
                if (victimVal >= 500) score += 5000;
                
                const see = this.quickSEE(board, move);
                if (see < -200) score -= 3000;
                else if (see > 100) score += 2000;
            }

            if (move.givesCheck) score += 4000;

            const histIdx = move.from.row * 9 * 10 * 9 + move.from.col * 10 * 9 + move.to.row * 9 + move.to.col;
            score += Math.min((this.historyTable[histIdx] || 0) / 10, 1000);

            const centerDist = Math.abs(move.to.row - 4.5) + Math.abs(move.to.col - 4);
            const fromCenter = Math.abs(move.from.row - 4.5) + Math.abs(move.from.col - 4);
            if (centerDist < fromCenter) score += 300;

            score += Math.random() * 40;
            moveScores.set(move, score);
        }

        return moves.sort((a, b) => moveScores.get(b) - moveScores.get(a));
    }

    orderCaptures(board, captures) {
        return captures.sort((a, b) => {
            const valA = (this.pieceValues[a.targetType] || 0) * 10 - (this.pieceValues[a.pieceType] || 0);
            const valB = (this.pieceValues[b.targetType] || 0) * 10 - (this.pieceValues[b.pieceType] || 0);
            const seeA = this.quickSEE(board, a);
            const seeB = this.quickSEE(board, b);
            return (valB + seeB * 2) - (valA + seeA * 2);
        });
    }

    filterAndSortMoves(board, moves, player) {
        const safeMoves = this.filterDangerousMoves(board, moves, player);
        return this.orderMoves(board, safeMoves, player, null, 0, 1);
    }

    evaluateMoveRisks(board, moves, player) {
        if (!this.openingBook || !this.openingBook.bookData || !this.openingBook.bookData.traps) {
            return moves.map(m => ({...m, riskLevel: 0, isBait: false}));
        }
        
        const opponent = this.getOpponent(player);
        const evaluatedMoves = [];
        
        for (const move of moves) {
            const undoInfo = this.makeMove(board, move.from, move.to);
            
            let riskLevel = 0;
            let isBait = false;
            let trapName = '';
            
            for (const trap of this.openingBook.bookData.traps) {
                if (trap.trapMove && this.matchesTrapTrigger(move, trap, board, opponent)) {
                    const myCounterTrap = this.findBookTrap(board, player, move);
                    
                    if (myCounterTrap) {
                        riskLevel = 1;
                        isBait = true;
                        trapName = trap.name;
                    } else if (trap.dangerLevel === 'high') {
                        riskLevel = 2;
                        trapName = trap.name;
                    } else {
                        riskLevel = 1;
                        trapName = trap.name;
                    }
                    break;
                }
            }
            
            this.undoMove(board, undoInfo);
            
            evaluatedMoves.push({
                ...move,
                riskLevel,
                isBait,
                trapName: riskLevel > 0 ? trapName : ''
            });
        }
        
        return evaluatedMoves;
    }

    filterDangerousMoves(board, moves, player) {
        const evaluated = this.evaluateMoveRisks(board, moves, player);
        
        const safeMoves = evaluated.filter(m => m.riskLevel < 2);
        
        if (safeMoves.length === 0) {
            console.warn('⚠️ 所有走法均含风险，选择风险最低的诱饵');
            evaluated.sort((a, b) => a.riskLevel - b.riskLevel);
            return evaluated.slice(0, Math.max(1, Math.floor(evaluated.length * 0.3)));
        }
        
        safeMoves.forEach(m => {
            if (m.isBait) m.tacticalValue = 800;
        });
        
        return safeMoves;
    }

    movesEqual(a, b) {
        if (!a || !b || !a.from || !b.from) return false;
        return a.from.row === b.from.row && a.from.col === b.from.col &&
               a.to.row === b.to.row && a.to.col === b.to.col;
    }

    quickSEE(board, move) {
        if (!move.isCapture) return 0;
        const valVictim = this.pieceValues[move.targetType] || 0;
        const valAttacker = this.pieceValues[move.pieceType] || 0;
        return valVictim - valAttacker * 0.5;
    }

    // ==================== 局面分析 ====================

    analyzeGamePhase(board, moveHistory) {
        let strongPieces = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c].toLowerCase();
                if (['r','n','c'].includes(p)) strongPieces++;
            }
        }

        if (strongPieces >= 10) {
            this.dynamicParams.gamePhase = 'opening';
            this.dynamicParams.phaseFactor = 0;
        } else if (strongPieces >= 6) {
            this.dynamicParams.gamePhase = 'midgame';
            this.dynamicParams.phaseFactor = 0.5;
        } else if (strongPieces >= 3) {
            this.dynamicParams.gamePhase = 'late_midgame';
            this.dynamicParams.phaseFactor = 0.8;
        } else {
            this.dynamicParams.gamePhase = 'endgame';
            this.dynamicParams.phaseFactor = 1;
        }
    }

    identifyFocusAreas(board, player) {
        const areas = [];


        const kingPos = this.findKing(board, player);
        const enemyKingPos = this.findKing(board, this.getOpponent(player));
        if (kingPos) areas.push({ center: kingPos, radius: 2, weight: 3 });
        if (enemyKingPos) areas.push({ center: enemyKingPos, radius: 2, weight: 2.5 });
        return areas;
    }

    findKing(board, player) {
        const kingChar = player === 'red' ? 'K' : 'k';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === kingChar) return { row: r, col: c };
            }
        }
        return null;
    }

    calculateDynamicDepth() {
        let depth = this.config.depth;
        if (this.dynamicParams.gamePhase === 'endgame') depth += 2;
        if (this.dynamicParams.timePressure) depth = Math.max(2, depth - 2);
        return Math.min(depth, this.config.maxDepth);
    }

    calculateExtension(board, move, player, depth, moveIndex) {
        let ext = 0;
        if (move.givesCheck) {
            ext += 1;
            const newBoard = this.simulateMove(board, move.from, move.to);
            const oppMoves = this.generateAllMoves(newBoard, this.getOpponent(player));
            let allCheck = true;
            for (const om of oppMoves) {
                const testBoard = this.simulateMove(newBoard, om.from, om.to);
                if (!this.isInCheck(testBoard, player)) {
                    allCheck = false;
                    break;
                }
            }
            if (allCheck) ext += 1;
        }
        if (move.isCapture && (this.pieceValues[move.targetType] || 0) >= 500) ext += 1;
        return Math.min(ext, 2);
    }

    // ==================== 时间控制 ====================

    isTimeCritical(threshold = 1.0) {
        return (Date.now() - this.stats.searchStartTime) > (this.config.timeLimit * threshold);
    }

    shouldStopSearch(ply) {
        return this.isTimeCritical(0.95) || ply > 60;
    }

    // ==================== 统计与日志 ====================

    resetStats() {
        this.stats = {
            nodesSearched: 0, qNodesSearched: 0, transpositionHits: 0,
            cutoffs: 0, nullMovePrunes: 0, lmReductions: 0, deltaPrunes: 0,
            searchStartTime: Date.now(), maxDepthReached: 0,
            extensions: 0, tacticalPrunes: 0, selectiveExtensions: 0,
            bookHits: { opening: 0, tactic: 0, endgame: 0, midgame: 0, trap: 0 }
        };
    }

    logStatistics() {
        const elapsed = Date.now() - this.stats.searchStartTime;
        const nps = elapsed > 0 ? Math.floor(this.stats.nodesSearched / (elapsed / 1000)) : 0;
        const bookTotal = Object.values(this.stats.bookHits).reduce((a,b)=>a+b,0);
        console.log(`⚡雷霆v5.0[子力优化] 深度:${this.stats.maxDepthReached} 节点:${this.stats.nodesSearched} NPS:${nps} 棋库命中:${bookTotal} 阶段:${this.dynamicParams.gamePhase}`);
    }

    setDifficulty(level) {
        const levels = {
            'easy': { depth: 2, timeLimit: 2000 },
            'medium': { depth: 4, timeLimit: 3000 },
            'hard': { depth: 6, timeLimit: 5000 },
            'expert': { depth: 8, timeLimit: 8000 },
            'master': { depth: 10, timeLimit: 12000 }
        };
        if (levels[level]) {
            Object.assign(this.config, levels[level]);
            console.log(`难度设置为: ${level}`);
        }
    }

    getStats() {
        const elapsed = Date.now() - this.stats.searchStartTime;
        return {
            nodesEvaluated: this.stats.nodesSearched,
            maxDepthReached: this.stats.maxDepthReached,
            timeElapsed: elapsed,
            nps: elapsed > 0 ? Math.floor(this.stats.nodesSearched / (elapsed / 1000)) : 0,
            gamePhase: this.dynamicParams.gamePhase,
            bookHits: this.stats.bookHits
        };
    }

    // ==================== 辅助方法 ====================

    getMyPieces(board, player) {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                const piecePlayer = p === p.toUpperCase() ? 'red' : 'black';
                if (piecePlayer === player) {
                    pieces.push({ row: r, col: c, type: p, piece: p });
                }
            }
        }
        return pieces;
    }

    generateAllMovesForPiece(board, row, col, piece) {
        const moves = this.generatePieceMoves(board, row, col, piece);
        return moves.map(to => ({
            from: {row, col},
            to: to,
            piece: piece
        }));
    }

    getTopNMoves(board, player, n, depth = 2) {
        const moves = this.generateAllMoves(board, player);
        const legalMoves = moves.filter(m => this.validateMoveStrict(board, m, player));
        
        const scoredMoves = [];
        for (const move of legalMoves.slice(0, 15)) {
            const undo = this.makeMove(board, move.from, move.to);
            const score = depth <= 1 ? this.evaluate(board, player) 
                                     : -this.pvsSearch(board, depth-1, -Infinity, Infinity, this.getOpponent(player), move, 1);
            this.undoMove(board, undo);
            scoredMoves.push({...move, score});
        }
        
        return scoredMoves.sort((a, b) => b.score - a.score).slice(0, n);
    }

    evaluateAttackPotential(board, player) {
        let potential = 0;
        const opponent = this.getOpponent(player);
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return 0;
        
        const myPieces = this.getMyPieces(board, player);
        for (const piece of myPieces) {
            const dist = Math.abs(piece.row - enemyKing.row) + Math.abs(piece.col - enemyKing.col);
            if (dist < 4) potential += (4 - dist) * 50;
        }
        return potential;
    }

    simulateMove(board, from, to) {
        const newBoard = board.map(row => [...row]);
        const piece = newBoard[from.row][from.col];
        newBoard[to.row][to.col] = piece;
        newBoard[from.row][from.col] = ' ';
        return newBoard;
    }

    checkEmergency(board, player) {
        if (this.isInCheck(board, player)) {
            const moves = this.generateAllMoves(board, player).filter(m => 
                !this.wouldBeInCheck(board, m.from, m.to, player) && 
                !this.wouldCauseKingsFace(board, m.from, m.to)
            );
            if (moves.length > 0) {
                moves.sort((a, b) => {
                    let sa = 0, sb = 0;
                    if (a.givesCheck) sa += 1000;
                    if (b.givesCheck) sb += 1000;
                    if (a.isCapture) sa += this.pieceValues[a.targetType] || 0;
                    if (b.isCapture) sb += this.pieceValues[b.targetType] || 0;
                    return sb - sa;
                });
                return moves[0];
            }
        }
        return null;
    }

    noMovesAvailable(board, player) {
        const inCheck = this.isInCheck(board, player);
        return {
            from: null, to: null, piece: null, isResign: true,
            reason: inCheck ? 'checkmate' : 'stalemate',
            message: `${player === 'red' ? '红方' : '黑方'}${inCheck ? '被绝杀' : '被困毙'}！`
        };
    }

    selectSafeMove(board, moves, player) {
        for (const move of moves) {
            if (this.validateMoveStrict(board, move, player)) return move;
        }
        return moves[0];
    }

    getBookMove(board, player, moveHistory) {
        if (!this.openingBook) return null;
        try {
            if (typeof this.openingBook.getBookMove === 'function') {
                return this.openingBook.getBookMove(board, player, moveHistory);
            }
        } catch (e) {
            console.error('棋库调用错误:', e);
        }
        return null;
    }
}

// 兼容性导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThunderAIEngine;
} else if (typeof window !== 'undefined') {
    window.ThunderAIEngine = ThunderAIEngine;
}
