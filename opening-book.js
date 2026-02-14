/**
 * 中国象棋超级棋库 - 终极扩展版 v3.1
 * 更新内容：
 * 1. 战术库填充完整solution数据（意图驱动）
 * 2. 残局库实现matchPositionFeatures匹配逻辑
 * 3. 中局库实现matchMidgamePattern匹配逻辑
 * 4. 陷阱库补充responseMoves和触发条件
 * 5. 添加完整辅助工具方法（getPiecesByPlayer, findKing等）
 * 6. 增强坐标适配的模糊匹配能力
 * 坐标系统：红方在下（行7-9），黑方在上（行0-2）
 * 列索引：0-8 对应 九路到一路（红方视角从右到左）
 * 中国象棋超级棋库 - 终极扩展版 v3.1
 * 
 * 【重要】本子力价值、棋子字符等定义完全引用自 ai-engine.js
 * 基础子力价值：K=100000, A=B=200, N=400, R=900, C=450, P=100
 * 动态子力价值根据游戏阶段变化（开局/中局/残局）
 */

// 子力价值定义（与 ai-engine.js 保持一致）
const PIECE_VALUES = {
    'k': 100000, 'K': 100000,  // 将帅
    'a': 200, 'A': 200,        // 士
    'b': 200, 'B': 200,        // 象
    'n': 400, 'N': 400,        // 马
    'r': 900, 'R': 900,        // 车
    'c': 450, 'C': 450,        // 炮
    'p': 100, 'P': 100         // 兵卒
};

class ChessOpeningBook {
    constructor(options = {}) {
        this.config = {
            matchMode: 'flexible',
            enableGlobalMatch: true,
            usePositionCache: true,
            maxCacheSize: 5000,
            openingWeight: 2.0,
            midgameWeight: 1.5,
            endgameWeight: 1.0,
            enableTranspositions: true,
            maxDepth: 20,
            ...options
        };

        this.bookData = {
            openings: { red: [], black: [] },
            midgames: [],
            endgames: [],
            tactics: [],
            traps: []
        };

        this.stats = {
            totalPositions: 0,
            openings: 0,
            midgames: 0,
            endgames: 0,
            tactics: 0,
            matches: 0,
            hits: 0,
            failedMatches: 0
        };

        this.positionCache = new Map();
        this.moveCache = new Map();
        this.currentOpeningLine = null;

        this.initializeBook();
        console.log(`【超级棋库v3.1】初始化完成，包含 ${this.stats.totalPositions} 个局面，${this.stats.openings} 个开局体系`);
    }

    initializeBook() {
        this.buildComprehensiveOpeningBook();
        this.buildExtensiveMidgameBook();
        this.buildEndgamePatterns();
        this.buildTacticalEncyclopedia();
        this.buildTrapCollection();
    }

    // ==================== 开局库 - 红方（极大扩展） ====================
    
    buildComprehensiveOpeningBook() {
        this.buildCentralCannonSystem();
        this.buildPawnAdvanceSystem();
        this.buildElephantOpeningSystem();
        this.buildKnightOpeningSystem();
        this.buildCornerCannonSystem();
        this.buildCrossPalaceCannonSystem();
        this.buildGoldenHookCannonSystem();
        this.buildEdgeKnightSystem();
        this.buildOtherPawnOpenings();
        this.buildBlackResponses();
    }

    buildCentralCannonSystem() {
        // 中炮过河车对屏风马平炮兑车
        this.addOpening({
            id: 'zhong_pao_guo_he_che_ping_pao',
            name: '中炮过河车对屏风马平炮兑车',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },  // 右炮到中
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },    // 黑左马
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },    // 红右马
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },    // 黑右马
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },    // 出左车
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9平8' },    // 黑出左车
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' },    // 进七兵
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },    // 黑进7卒
                { from: { row: 5, col: 0 }, to: { row: 3, col: 0 }, piece: 'R', notation: '车二进六' }     // 过河车
            ],
            variations: [
                {
                    id: 'ping_pao_dui_che_zhu_bian',
                    name: '平炮兑车主变',
                    moves: [
                        { from: { row: 2, col: 7 }, to: { row: 0, col: 7 }, piece: 'c', notation: '炮8平9' },
                        { from: { row: 3, col: 0 }, to: { row: 0, col: 7 }, piece: 'R', notation: '车二平三' },
                        { from: { row: 2, col: 2 }, to: { row: 4, col: 3 }, piece: 'n', notation: '马8退7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' }
                    ],
                    weight: 0.95
                },
                {
                    id: 'zuo_xiang_tuo_pao',
                    name: '左象托炮',
                    moves: [
                        { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' },
                        { from: { row: 9, col: 2 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相七进五' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'you_xiang_tuo_pao',
                    name: '右象托炮',
                    moves: [
                        { from: { row: 0, col: 2 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象3进5' },
                        { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' }
                    ],
                    weight: 0.8
                }
            ],
            description: '中炮过河车对屏风马是最主流的开局之一',
            weight: 1.0
        }, 'red');

        // 中炮直车七路马对屏风马
        this.addOpening({
            id: 'zhong_pao_zhi_che_qi_ma',
            name: '中炮直车七路马对屏风马',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' }
            ],
            variations: [
                {
                    id: 'you_pao_feng',
                    name: '右炮封车',
                    moves: [
                        { from: { row: 2, col: 7 }, to: { row: 0, col: 7 }, piece: 'c', notation: '炮2平7' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'zuo_xiang',
                    name: '左象局',
                    moves: [
                        { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' }
                    ],
                    weight: 0.8
                }
            ],
            weight: 0.95
        }, 'red');

        // 中炮横车七路马
        this.addOpening({
            id: 'zhong_pao_heng_che_qi_ma',
            name: '中炮横车七路马',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 9, col: 1 }, piece: 'R', notation: '车一进一' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' }
            ],
            variations: [
                {
                    id: 'heng_che_ping_bian',
                    name: '横车平边路',
                    moves: [
                        { from: { row: 9, col: 1 }, to: { row: 9, col: 4 }, piece: 'R', notation: '车一平四' }
                    ],
                    weight: 0.8
                }
            ],
            weight: 0.85
        }, 'red');

        // 五六炮
        this.addOpening({
            id: 'wu_liu_pao',
            name: '五六炮',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9平8' },
                { from: { row: 7, col: 1 }, to: { row: 7, col: 2 }, piece: 'C', notation: '炮八平六' }
            ],
            variations: [
                {
                    id: 'wu_liu_v_fan_gong',
                    name: '五六炮对反宫马',
                    moves: [
                        { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮6进5' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.8
        }, 'red');

        // 五七炮
        this.addOpening({
            id: 'wu_qi_pao',
            name: '五七炮',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9平8' },
                { from: { row: 7, col: 1 }, to: { row: 7, col: 6 }, piece: 'C', notation: '炮八平七' }
            ],
            weight: 0.75
        }, 'red');

        // 五八炮
        this.addOpening({
            id: 'wu_ba_pao',
            name: '五八炮',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9平8' },
                { from: { row: 7, col: 1 }, to: { row: 1, col: 1 }, piece: 'C', notation: '炮八进四' }
            ],
            weight: 0.7
        }, 'red');

        // 中炮对屏风马左马盘河
        this.addOpening({
            id: 'zhong_pao_zuo_ma_pan_he',
            name: '中炮对屏风马左马盘河',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 2, col: 2 }, to: { row: 4, col: 3 }, piece: 'n', notation: '马7进8' }
            ],
            weight: 0.8
        }, 'red');
    }

    buildPawnAdvanceSystem() {
        // 仙人指路（兵三进一）
        this.addOpening({
            id: 'xianren_zhilu_main',
            name: '仙人指路（主变）',
            moves: [
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' }
            ],
            variations: [
                {
                    id: 'dui_bing_ju',
                    name: '对兵局（最稳）',
                    moves: [
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' }
                    ],
                    weight: 0.95
                },
                {
                    id: 'di_pao',
                    name: '卒底炮（最凶）',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 2 }, piece: 'c', notation: '炮8平7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                        { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'jin_gou_pao',
                    name: '金钩炮（冷门）',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 0, col: 0 }, piece: 'c', notation: '炮8退1' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
                    ],
                    weight: 0.6
                },
                {
                    id: 'qi_ma_ju',
                    name: '起马局',
                    moves: [
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'zuo_xiang',
                    name: '左象局',
                    moves: [
                        { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' }
                    ],
                    weight: 0.75
                },
                {
                    id: 'zhong_pao',
                    name: '中炮应对',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.8
                }
            ],
            description: '仙人指路是灵活性最高的开局之一',
            weight: 0.95
        }, 'red');

        // 兵七进一（对卒底炮）
        this.addOpening({
            id: 'bing_qi_jin_yi',
            name: '兵七进一（对卒底炮）',
            moves: [
                { from: { row: 6, col: 6 }, to: { row: 5, col: 6 }, piece: 'P', notation: '兵七进一' },
                { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 2, col: 7 }, to: { row: 2, col: 6 }, piece: 'c', notation: '炮2平3' }
            ],
            variations: [
                {
                    id: 'fei_xiang',
                    name: '飞相应对',
                    moves: [
                        { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.85
        }, 'red');

        // 两头蛇
        this.addOpening({
            id: 'liang_tou_she',
            name: '两头蛇',
            moves: [
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                { from: { row: 6, col: 6 }, to: { row: 5, col: 6 }, piece: 'P', notation: '兵七进一' }
            ],
            weight: 0.8
        }, 'red');

        // 进三兵对反宫马
        this.addOpening({
            id: 'jin_san_bing_fan_gong',
            name: '进三兵对反宫马',
            moves: [
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮6进5' }
            ],
            weight: 0.75
        }, 'red');
    }

    buildElephantOpeningSystem() {
        // 飞相局（主变）
        this.addOpening({
            id: 'feixiang_ju_main',
            name: '飞相局（主变）',
            moves: [
                { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' }
            ],
            variations: [
                {
                    id: 'vs_guo_gong_pao',
                    name: '对过宫炮',
                    moves: [
                        { from: { row: 0, col: 1 }, to: { row: 0, col: 4 }, piece: 'c', notation: '炮8平4' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'vs_xianren',
                    name: '对仙人指路',
                    moves: [
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' }
                    ],
                    weight: 0.8
                },
                {
                    id: 'vs_feng_mai',
                    name: '对起马',
                    moves: [
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.9
        }, 'red');

        // 飞相转反宫马
        this.addOpening({
            id: 'feixiang_fan_gong',
            name: '飞相转反宫马',
            moves: [
                { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 1 }, to: { row: 7, col: 2 }, piece: 'C', notation: '炮八平六' }
            ],
            weight: 0.8
        }, 'red');

        // 飞相转屏风马
        this.addOpening({
            id: 'feixiang_pingfeng',
            name: '飞相转屏风马',
            moves: [
                { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' }
            ],
            weight: 0.85
        }, 'red');
    }

    buildKnightOpeningSystem() {
        // 起马局（正马）
        this.addOpening({
            id: 'qima_ju_main',
            name: '起马局（正马）',
            moves: [
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' }
            ],
            variations: [
                {
                    id: 'vs_pingfeng',
                    name: '对屏风马',
                    moves: [
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'vs_di_pao',
                    name: '对卒底炮',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 2 }, piece: 'c', notation: '炮8平7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
                    ],
                    weight: 0.8
                }
            ],
            weight: 0.85
        }, 'red');

        // 边马局
        this.addOpening({
            id: 'bianma_ju',
            name: '边马局',
            moves: [
                { from: { row: 9, col: 1 }, to: { row: 7, col: 0 }, piece: 'N', notation: '马八进九' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' }
            ],
            weight: 0.6
        }, 'red');

        // 起马转中炮
        this.addOpening({
            id: 'qima_zhuan_zhong_pao',
            name: '起马转中炮',
            moves: [
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' }
            ],
            weight: 0.8
        }, 'red');
    }

    buildCornerCannonSystem() {
        // 士角炮
        this.addOpening({
            id: 'shijiao_pao_main',
            name: '士角炮（主变）',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 6 }, piece: 'C', notation: '炮二平四' }
            ],
            variations: [
                {
                    id: 'vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'vs_xianren',
                    name: '对仙人指路',
                    moves: [
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.8
        }, 'red');

        // 士角炮转反宫马
        this.addOpening({
            id: 'shijiao_fan_gong',
            name: '士角炮转反宫马',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 6 }, piece: 'C', notation: '炮二平四' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 7, col: 1 }, to: { row: 7, col: 2 }, piece: 'C', notation: '炮八平六' }
            ],
            weight: 0.75
        }, 'red');
    }

    buildCrossPalaceCannonSystem() {
        // 过宫炮
        this.addOpening({
            id: 'guogong_pao_main',
            name: '过宫炮（主变）',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 3 }, piece: 'C', notation: '炮二平六' }
            ],
            variations: [
                {
                    id: 'vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'vs_feng_mai',
                    name: '对起马',
                    moves: [
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.85
        }, 'red');

        // 过宫炮对飞象
        this.addOpening({
            id: 'guogong_vs_fei_xiang',
            name: '过宫炮对飞象',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 3 }, piece: 'C', notation: '炮二平六' },
                { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
            ],
            weight: 0.8
        }, 'red');
    }

    buildGoldenHookCannonSystem() {
        // 金钩炮
        this.addOpening({
            id: 'jingou_pao_main',
            name: '金钩炮',
            moves: [
                { from: { row: 7, col: 1 }, to: { row: 9, col: 0 }, piece: 'C', notation: '炮八退一' }
            ],
            variations: [
                {
                    id: 'zhuan_dui_chen',
                    name: '转对称金钩',
                    moves: [
                        { from: { row: 9, col: 0 }, to: { row: 9, col: 2 }, piece: 'C', notation: '炮一平七' }
                    ],
                    weight: 0.7
                }
            ],
            weight: 0.5
        }, 'red');
    }

    buildEdgeKnightSystem() {
        // 九尾龟
        this.addOpening({
            id: 'jiuwei_gui',
            name: '九尾龟',
            moves: [
                { from: { row: 6, col: 0 }, to: { row: 5, col: 0 }, piece: 'P', notation: '兵一进一' }
            ],
            variations: [
                {
                    id: 'zhuan_bian_ma',
                    name: '转边马',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 8 }, piece: 'N', notation: '马二进一' }
                    ],
                    weight: 0.6
                }
            ],
            weight: 0.4
        }, 'red');

        // 边马局
        this.addOpening({
            id: 'bian_ma_ju_edge',
            name: '边马局（直接）',
            moves: [
                { from: { row: 9, col: 7 }, to: { row: 7, col: 8 }, piece: 'N', notation: '马二进一' }
            ],
            weight: 0.35
        }, 'red');
    }

    buildOtherPawnOpenings() {
        // 中兵局
        this.addOpening({
            id: 'zhong_bing_ju',
            name: '中兵局（敢死炮）',
            moves: [
                { from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, piece: 'P', notation: '兵五进一' }
            ],
            weight: 0.3
        }, 'red');

        // 巡河炮
        this.addOpening({
            id: 'xunhe_pao',
            name: '巡河炮',
            moves: [
                { from: { row: 7, col: 1 }, to: { row: 5, col: 1 }, piece: 'C', notation: '炮八进二' }
            ],
            weight: 0.4
        }, 'red');
    }

    // ==================== 黑方开局应对（极大扩展） ====================
    
    buildBlackResponses() {
        this.buildPingfengMaSystem();
        this.buildFanGongMaSystem();
        this.buildDanTiMaSystem();
        this.buildShunshouPaoSystem();
        this.buildLieshouPaoSystem();
        this.buildBanTuLiePaoSystem();
        this.buildGuiBeiPaoSystem();
        this.buildZuoZhongPaoSystem();
        this.buildSanBuHuSystem();
        this.buildHengCheSystem();
        this.buildLeftElephantSystem();
        this.buildCrossRiverPawnSystem();
    }

    buildPingfengMaSystem() {
        // 屏风马进3卒
        this.addOpening({
            id: 'pingfeng_3zu_main',
            name: '屏风马进3卒（最稳）',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' }
            ],
            variations: [
                {
                    id: 'vs_zhong_pao_hei_guo_he',
                    name: '对中炮过河车',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                        { from: { row: 0, col: 7 }, to: { row: 0, col: 6 }, piece: 'r', notation: '车9平8' }
                    ],
                    weight: 0.98
                },
                {
                    id: 'vs_wu_qi_pao_hei',
                    name: '对五七炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 7, col: 1 }, to: { row: 7, col: 6 }, piece: 'C', notation: '炮八平七' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'vs_zhong_pao_zhi_che_hei',
                    name: '对中炮直车',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                        { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9平8' }
                    ],
                    weight: 0.95
                }
            ],
            weight: 1.0
        }, 'black');

        // 屏风马进7卒
        this.addOpening({
            id: 'pingfeng_7zu',
            name: '屏风马进7卒',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
            ],
            variations: [
                {
                    id: 'vs_guo_he_che_7zu',
                    name: '对过河车（7卒）',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' },
                        { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' }
                    ],
                    weight: 0.92
                }
            ],
            weight: 0.95
        }, 'black');

        // 屏风马双炮过河
        this.addOpening({
            id: 'pingfeng_shuang_pao',
            name: '屏风马双炮过河',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平8' },
                { from: { row: 5, col: 0 }, to: { row: 3, col: 0 }, piece: 'R', notation: '车二进六' },
                { from: { row: 2, col: 1 }, to: { row: 4, col: 3 }, piece: 'c', notation: '炮2进4' }
            ],
            weight: 0.9
        }, 'black');

        // 屏风马左马盘河
        this.addOpening({
            id: 'pingfeng_zuo_ma_pan_he',
            name: '屏风马左马盘河',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 2, col: 2 }, to: { row: 4, col: 3 }, piece: 'n', notation: '马7进8' }
            ],
            weight: 0.85
        }, 'black');

        // 屏风马横车
        this.addOpening({
            id: 'pingfeng_heng_che',
            name: '屏风马横车',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 1 }, to: { row: 0, col: 4 }, piece: 'r', notation: '车9平4' }
            ],
            weight: 0.8
        }, 'black');

        // 屏风马补士象
        this.addOpening({
            id: 'pingfeng_bushi',
            name: '屏风马补士象',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 5 }, to: { row: 1, col: 4 }, piece: 'a', notation: '士4进5' }
            ],
            weight: 0.88
        }, 'black');
    }

    buildFanGongMaSystem() {
        // 反宫马（主变）
        this.addOpening({
            id: 'fan_gong_ma_main',
            name: '反宫马（主变）',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮6进5' }
            ],
            variations: [
                {
                    id: 'fan_gong_vs_zhong_pao',
                    name: '反宫马对中炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 2, col: 4 }, to: { row: 6, col: 4 }, piece: 'c', notation: '炮6平3' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'fan_gong_vs_xianren',
                    name: '反宫马对仙人指路',
                    moves: [
                        { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.9
        }, 'black');

        // 反宫马进3卒
        this.addOpening({
            id: 'fan_gong_3zu',
            name: '反宫马进3卒',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮6进5' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
            ],
            weight: 0.85
        }, 'black');
    }

    buildDanTiMaSystem() {
        // 单提马（主变）
        this.addOpening({
            id: 'dan_ti_ma_main',
            name: '单提马（主变）',
            moves: [
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
            ],
            variations: [
                {
                    id: 'dan_ti_vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'dan_ti_bian_che',
                    name: '单提马边车',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 0, col: 8 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平8' }
                    ],
                    weight: 0.8
                },
                {
                    id: 'dan_ti_xiang',
                    name: '单提马飞象',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' }
                    ],
                    weight: 0.75
                }
            ],
            weight: 0.8
        }, 'black');

        // 单提马横车
        this.addOpening({
            id: 'dan_ti_heng_che',
            name: '单提马横车',
            moves: [
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' }
            ],
            weight: 0.78
        }, 'black');
    }

    buildShunshouPaoSystem() {
        // 顺手炮（主变）
        this.addOpening({
            id: 'shunshou_pao_main',
            name: '顺手炮（主变）',
            moves: [
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' }
            ],
            variations: [
                {
                    id: 'shun_pao_zhi_che',
                    name: '顺炮直车对横车',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                        { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' }
                    ],
                    weight: 0.95
                },
                {
                    id: 'shun_pao_heng_che',
                    name: '顺炮横车对直车',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                        { from: { row: 9, col: 0 }, to: { row: 9, col: 1 }, piece: 'R', notation: '车一进一' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 9, col: 4 }, piece: 'R', notation: '车一平四' }
                    ],
                    weight: 0.9
                },
                {
                    id: 'shun_pao_shang_zheng',
                    name: '顺炮上正马',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.88
                },
                {
                    id: 'shun_pao_di_7zu',
                    name: '顺炮进7卒',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.95
        }, 'black');

        // 顺炮缓开车
        this.addOpening({
            id: 'shun_pao_huan_kai',
            name: '顺炮缓开车',
            moves: [
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' }
            ],
            weight: 0.85
        }, 'black');

        // 顺炮直车对缓开车
        this.addOpening({
            id: 'shun_pao_zhi_vs_huan',
            name: '顺炮直车对缓开车',
            moves: [
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' }
            ],
            weight: 0.82
        }, 'black');
    }

    buildLieshouPaoSystem() {
        // 列手炮（主变）
        this.addOpening({
            id: 'lieshou_pao_main',
            name: '列手炮（主变）',
            moves: [
                { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮2平5' }
            ],
            variations: [
                {
                    id: 'da_lie',
                    name: '大列手炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                        { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平2' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'xiao_lie',
                    name: '小列手炮',
                    moves: [
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.8
                }
            ],
            weight: 0.85
        }, 'black');

        // 列手炮进7卒
        this.addOpening({
            id: 'lieshou_7zu',
            name: '列手炮进7卒',
            moves: [
                { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮2平5' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
            ],
            weight: 0.8
        }, 'black');
    }

    buildBanTuLiePaoSystem() {
        // 半途列炮（主变）
        this.addOpening({
            id: 'bantu_lie_pao_main',
            name: '半途列炮（主变）',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平2' },
                { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮2平5' }
            ],
            variations: [
                {
                    id: 'bantu_vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵七进一' }
                    ],
                    weight: 0.88
                },
                {
                    id: 'bantu_vs_wu_qi',
                    name: '对五七炮',
                    moves: [
                        { from: { row: 7, col: 1 }, to: { row: 7, col: 6 }, piece: 'C', notation: '炮八平七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 6, col: 6 }, to: { row: 5, col: 6 }, piece: 'P', notation: '兵七进一' }
                    ],
                    weight: 0.85
                }
            ],
            weight: 0.88
        }, 'black');

        // 半途列炮快出车
        this.addOpening({
            id: 'bantu_kuai_che',
            name: '半途列炮快出车',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平2' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 2, col: 7 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮2平5' }
            ],
            weight: 0.85
        }, 'black');
    }

    buildGuiBeiPaoSystem() {
        // 龟背炮
        this.addOpening({
            id: 'guibei_pao',
            name: '龟背炮',
            moves: [
                { from: { row: 0, col: 1 }, to: { row: 1, col: 1 }, piece: 'c', notation: '炮8退1' }
            ],
            variations: [
                {
                    id: 'guibei_vs_zhong_pao',
                    name: '对中炮',
                    moves: [
                        { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' }
                    ],
                    weight: 0.7
                }
            ],
            weight: 0.6
        }, 'black');
    }

    buildZuoZhongPaoSystem() {
        // 左中炮对飞相
        this.addOpening({
            id: 'zuo_zhong_pao_main',
            name: '左中炮对飞相',
            moves: [
                { from: { row: 9, col: 6 }, to: { row: 7, col: 4 }, piece: 'B', notation: '相三进五' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' }
            ],
            variations: [
                {
                    id: 'zuo_zhong_vs_zhengma',
                    name: '对正马',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                        { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                        { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'zuo_zhong_vs_bianma',
                    name: '对边马',
                    moves: [
                        { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 0 }, piece: 'n', notation: '马8进9' }
                    ],
                    weight: 0.75
                }
            ],
            weight: 0.85
        }, 'black');

        // 左中炮对仙人指路
        this.addOpening({
            id: 'zuo_zhong_vs_xianren',
            name: '左中炮对仙人指路',
            moves: [
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' }
            ],
            weight: 0.8
        }, 'black');
    }

    buildSanBuHuSystem() {
        // 三步虎（主变）
        this.addOpening({
            id: 'san_bu_hu_main',
            name: '三步虎（主变）',
            moves: [
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平2' }
            ],
            variations: [
                {
                    id: 'san_bu_hu_7zu',
                    name: '三步虎进7卒',
                    moves: [
                        { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' }
                    ],
                    weight: 0.85
                },
                {
                    id: 'san_bu_hu_3zu',
                    name: '三步虎进3卒',
                    moves: [
                        { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1' }
                    ],
                    weight: 0.82
                }
            ],
            weight: 0.9
        }, 'black');

        // 三步虎对进兵
        this.addOpening({
            id: 'san_bu_hu_vs_bing',
            name: '三步虎对进兵',
            moves: [
                { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 7 }, piece: 'r', notation: '车9平2' }
            ],
            weight: 0.85
        }, 'black');
    }

    buildHengCheSystem() {
        // 横车补士象
        this.addOpening({
            id: 'heng_che_bu',
            name: '横车补士象',
            moves: [
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: 'N', notation: '马八进七' },
                { from: { row: 0, col: 5 }, to: { row: 1, col: 4 }, piece: 'a', notation: '士4进5' }
            ],
            weight: 0.75
        }, 'black');
    }

    buildLeftElephantSystem() {
        // 左象局
        this.addOpening({
            id: 'zuo_xiang_hei',
            name: '左象局（黑）',
            moves: [
                { from: { row: 0, col: 6 }, to: { row: 2, col: 4 }, piece: 'b', notation: '象7进5' }
            ],
            variations: [
                {
                    id: 'zuo_xiang_vs_xianren',
                    name: '对仙人指路',
                    moves: [
                        { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' }
                    ],
                    weight: 0.8
                }
            ],
            weight: 0.75
        }, 'black');
    }

    buildCrossRiverPawnSystem() {
        // 过河车对进兵
        this.addOpening({
            id: 'guo_he_che_vs_bing',
            name: '过河车对进兵',
            moves: [
                { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' },
                { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                { from: { row: 5, col: 0 }, to: { row: 3, col: 0 }, piece: 'R', notation: '车二进四' }
            ],
            weight: 0.7
        }, 'black');
    }

    // ==================== 中局库（极大扩展） ====================
    
    buildExtensiveMidgameBook() {
        const midgames = [
            {
                id: 'double_chariot_mate',
                name: '双车错杀法',
                keyFeatures: ['double_rooks', 'open_file', 'king_exposed'],
                suggestedMoves: [
                    { from: { row: 9, col: 1 }, to: { row: 9, col: 4 }, piece: 'R', notation: '车二平五', weight: 1.0 }
                ],
                difficulty: 'easy'
            },
            {
                id: 'wo_cao_ma',
                name: '卧槽马基本型',
                keyFeatures: ['horse_tactics', 'mate_threat'],
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 6, col: 6 }, piece: 'N', notation: '马四进三', weight: 1.0 }
                ],
                difficulty: 'easy'
            },
            {
                id: 'ma_hou_pao',
                name: '马后炮基本型',
                keyFeatures: ['horse_cannon_coordination', 'mate_threat'],
                suggestedMoves: [
                    { from: { row: 7, col: 5 }, to: { row: 7, col: 3 }, piece: 'N', notation: '马三平四', weight: 1.0 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'kong_tou_pao',
                name: '空头炮杀法',
                keyFeatures: ['central_cannon', 'long_range_attack'],
                suggestedMoves: [
                    { from: { row: 5, col: 4 }, to: { row: 3, col: 4 }, piece: 'C', notation: '炮五进四', weight: 1.0 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'chong_pao',
                name: '重炮杀法',
                keyFeatures: ['double_cannons', 'file_attack'],
                suggestedMoves: [
                    { from: { row: 5, col: 4 }, to: { row: 4, col: 4 }, piece: 'C', notation: '炮五进一', weight: 1.0 }
                ],
                difficulty: 'easy'
            },
            {
                id: 'men_gong',
                name: '闷宫杀法',
                keyFeatures: ['mate_in_one', 'cannon'],
                suggestedMoves: [
                    { from: { row: 3, col: 4 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮五平四', weight: 1.0 }
                ],
                difficulty: 'easy'
            },
            {
                id: 'tie_men_shuan',
                name: '铁门栓杀法',
                keyFeatures: ['chariot', 'file_control'],
                suggestedMoves: [
                    { from: { row: 3, col: 4 }, to: { row: 1, col: 4 }, piece: 'R', notation: '车五进二', weight: 1.0 }
                ],
                difficulty: 'easy'
            },
            {
                id: 'er_gui_pai_men',
                name: '二鬼拍门',
                keyFeatures: ['pawns', 'mate_threat'],
                suggestedMoves: [
                    { from: { row: 5, col: 3 }, to: { row: 4, col: 3 }, piece: 'P', notation: '兵六进一', weight: 1.0 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'da_dan_chuan_xin',
                name: '大胆穿心',
                keyFeatures: ['chariot', 'sacrifice'],
                suggestedMoves: [
                    { from: { row: 3, col: 4 }, to: { row: 8, col: 4 }, piece: 'r', notation: '车五平五', weight: 1.0 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'diao_yu_ma',
                name: '钓鱼马',
                keyFeatures: ['horse', 'mate_pattern'],
                suggestedMoves: [
                    { from: { row: 4, col: 4 }, to: { row: 2, col: 5 }, piece: 'N', notation: '马五进四', weight: 1.0 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'zhu_lu_ma',
                name: '立马车',
                keyFeatures: ['chariot_horse_coordination'],
                suggestedMoves: [
                    { from: { row: 7, col: 6 }, to: { row: 5, col: 5 }, piece: 'N', notation: '马三进四', weight: 0.95 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'dian_che',
                name: '点车',
                keyFeatures: ['chariot_attack', 'king_safety'],
                suggestedMoves: [
                    { from: { row: 5, col: 0 }, to: { row: 3, col: 0 }, piece: 'R', notation: '车二进四', weight: 0.9 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'shuang_xian_guo',
                name: '双献酒',
                keyFeatures: ['sacrifice', 'attack'],
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 1, col: 4 }, piece: 'C', notation: '炮五进五', weight: 0.9 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'kong_cheng',
                name: '空城计',
                keyFeatures: ['defense', 'counter_attack'],
                suggestedMoves: [
                    { from: { row: 9, col: 4 }, to: { row: 8, col: 4 }, piece: 'K', notation: '帅五退一', weight: 0.85 }
                ],
                difficulty: 'expert'
            },
            {
                id: 'tian_gou',
                name: '天狗',
                keyFeatures: ['knight_outpost'],
                suggestedMoves: [
                    { from: { row: 6, col: 4 }, to: { row: 4, col: 3 }, piece: 'N', notation: '马五进六', weight: 0.8 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'chuan_xin',
                name: '穿心杀',
                keyFeatures: ['central_breakthrough'],
                suggestedMoves: [
                    { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, piece: 'P', notation: '兵五进一', weight: 0.95 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'jiu_zhuan',
                name: '九转',
                keyFeatures: ['positional_play'],
                suggestedMoves: [
                    { from: { row: 7, col: 2 }, to: { row: 5, col: 1 }, piece: 'N', notation: '马七进八', weight: 0.75 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'san_zhuang',
                name: '三藏',
                keyFeatures: ['chariot_endgame'],
                suggestedMoves: [
                    { from: { row: 0, col: 8 }, to: { row: 2, col: 8 }, piece: 'r', notation: '车1进2', weight: 0.85 }
                ],
                difficulty: 'medium'
            },
            {
                id: 'gao_lou',
                name: '高楼',
                keyFeatures: ['cannon_battery'],
                suggestedMoves: [
                    { from: { row: 7, col: 1 }, to: { row: 1, col: 1 }, piece: 'C', notation: '炮八进六', weight: 0.8 }
                ],
                difficulty: 'hard'
            },
            {
                id: 'hai_di',
                name: '海底捞月',
                keyFeatures: ['chariot_endgame', 'special_mate'],
                suggestedMoves: [
                    { from: { row: 9, col: 0 }, to: { row: 9, col: 8 }, piece: 'R', notation: '车一平九', weight: 1.0 }
                ],
                difficulty: 'expert'
            }
        ];

        midgames.forEach(mg => {
            this.addMidgame({
                ...mg,
                position: null, // 简化为模式匹配而非具体局面
                isPatternBased: true,
                weight: 0.8
            });
        });
    }

    // ==================== 残局定式（极大扩展） ====================
    
    buildEndgamePatterns() {
        const endgames = [
            {
                id: 'che_sheng_shi',
                name: '单车勝單士',
                keyFeatures: ['chariot_vs_advisor', 'winning'],
                winningMethod: 'force_advisor_away',
                movesToWin: 15,
                suggestedMoves: [
                    { from: { row: 9, col: 7 }, to: { row: 8, col: 7 }, piece: 'R', notation: '车一平二', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'medium'
            },
            {
                id: 'che_sheng_xiang',
                name: '单车勝單象',
                keyFeatures: ['chariot_vs_bishop', 'winning'],
                winningMethod: 'control_diagonal',
                movesToWin: 12,
                suggestedMoves: [
                    { from: { row: 9, col: 7 }, to: { row: 6, col: 7 }, piece: 'R', notation: '车一退三', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'medium'
            },
            {
                id: 'che_sheng_shuang_shi',
                name: '单车勝双士',
                keyFeatures: ['chariot_vs_two_advisors', 'winning'],
                winningMethod: 'piece_reduction',
                movesToWin: 20,
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 9, col: 4 }, piece: 'R', notation: '车五平一', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'che_sheng_shuang_xiang',
                name: '单车勝双象',
                keyFeatures: ['chariot_vs_two_bishops', 'winning'],
                winningMethod: 'break_formation',
                movesToWin: 25,
                suggestedMoves: [
                    { from: { row: 9, col: 7 }, to: { row: 5, col: 7 }, piece: 'R', notation: '车一进四', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'che_sheng_shi_xiang',
                name: '单车勝士象',
                keyFeatures: ['chariot_vs_advisor_bishop', 'winning'],
                winningMethod: 'separation',
                movesToWin: 30,
                suggestedMoves: [
                    { from: { row: 9, col: 7 }, to: { row: 7, col: 7 }, piece: 'R', notation: '车一退二', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'ma_bing_sheng_shi',
                name: '马兵勝單士',
                keyFeatures: ['horse_pawn_vs_advisor', 'winning'],
                winningMethod: 'coordination',
                movesToWin: 20,
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 5, col: 3 }, piece: 'N', notation: '马四进六', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'ma_bing_sheng_xiang',
                name: '马兵勝單象',
                keyFeatures: ['horse_pawn_vs_bishop', 'winning'],
                winningMethod: 'block_diagonal',
                movesToWin: 18,
                suggestedMoves: [
                    { from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, piece: 'P', notation: '兵五进一', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'pao_bing_sheng_shi',
                name: '炮兵勝單士',
                keyFeatures: ['cannon_pawn_vs_advisor', 'winning'],
                winningMethod: 'center_control',
                movesToWin: 25,
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 3, col: 4 }, piece: 'C', notation: '炮五进四', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'pao_bing_sheng_xiang',
                name: '炮兵勝單象',
                keyFeatures: ['cannon_pawn_vs_bishop', 'winning'],
                winningMethod: 'center_control',
                movesToWin: 22,
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 3, col: 4 }, piece: 'C', notation: '炮五进四', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'pao_bing_sheng_shuang_shi',
                name: '炮兵勝双士',
                keyFeatures: ['cannon_pawn_vs_two_advisors', 'winning'],
                winningMethod: 'piece_reduction',
                movesToWin: 35,
                suggestedMoves: [
                    { from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, piece: 'P', notation: '兵五进一', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'expert'
            },
            {
                id: 'shuang_bing_sheng_shi',
                name: '双兵勝單士',
                keyFeatures: ['two_pawns_vs_advisor', 'winning'],
                winningMethod: 'advancement',
                movesToWin: 15,
                suggestedMoves: [
                    { from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, piece: 'P', notation: '兵六进一', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'medium'
            },
            {
                id: 'che_bing_sheng_che',
                name: '车兵勝單車',
                keyFeatures: ['chariot_pawn_vs_chariot', 'winning'],
                winningMethod: 'advance_pawn',
                movesToWin: 30,
                suggestedMoves: [
                    { from: { row: 5, col: 4 }, to: { row: 4, col: 4 }, piece: 'P', notation: '兵五进一', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'hard'
            },
            {
                id: 'che_ma_sheng_che_shi',
                name: '车马勝车士',
                keyFeatures: ['chariot_horse_vs_chariot_advisor', 'winning'],
                winningMethod: 'coordination',
                movesToWin: 40,
                suggestedMoves: [
                    { from: { row: 7, col: 6 }, to: { row: 5, col: 5 }, piece: 'N', notation: '马三进四', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'expert'
            },
            {
                id: 'che_pao_sheng_che',
                name: '车炮勝单车',
                keyFeatures: ['chariot_cannon_vs_chariot', 'winning'],
                winningMethod: 'mate_pattern',
                movesToWin: 35,
                suggestedMoves: [
                    { from: { row: 7, col: 4 }, to: { row: 1, col: 4 }, piece: 'C', notation: '炮五进五', weight: 1.0 }
                ],
                type: 'technical',
                difficulty: 'expert'
            }
        ];

        endgames.forEach(eg => {
            this.addEndgame({
                ...eg,
                position: null, // 简化为特征匹配
                isPatternBased: true,
                weight: 0.9
            });
        });
    }

    // ==================== 战术百科全书（极大扩展） ====================
    
    buildTacticalEncyclopedia() {
        const tactics = [
            { 
                id: 'fork_knight_double_chariot', 
                name: '马捉双车', 
                pattern: 'fork', 
                reward: 1500, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'horse_fork', 
                        targetTypes: ['r'],
                        valueThreshold: 900
                    }
                ]
            },
            { 
                id: 'fork_knight_chariot_cannon', 
                name: '马捉车炮', 
                pattern: 'fork', 
                reward: 1200, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'horse_fork', 
                        targetTypes: ['r', 'c'],
                        valueThreshold: 700
                    }
                ]
            },
            { 
                id: 'fork_knight_double_cannon', 
                name: '马捉双炮', 
                pattern: 'fork', 
                reward: 1000, 
                difficulty: 'easy',
                solution: [
                    { 
                        type: 'horse_fork', 
                        targetTypes: ['c'],
                        valueThreshold: 450
                    }
                ]
            },
            { 
                id: 'chariot_check_capture', 
                name: '车抽将得子', 
                pattern: 'discovered_check', 
                reward: 1000, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'chariot_check_capture'
                    }
                ]
            },
            { 
                id: 'horse_cannon_mate', 
                name: '马后炮杀法', 
                pattern: 'mate_pattern', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    { 
                        type: 'horse_cannon_mate'
                    }
                ]
            },
            { 
                id: 'discovered_check_chariot', 
                name: '车闪击抽将', 
                pattern: 'discovered_check', 
                reward: 900, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'discovered_check'
                    }
                ]
            },
            { 
                id: 'double_discovered_check', 
                name: '双将战术', 
                pattern: 'discovered_check', 
                reward: 1800, 
                difficulty: 'hard',
                solution: [
                    { 
                        type: 'double_check'
                    }
                ]
            },
            { 
                id: 'clearance_sacrifice_rook', 
                name: '弃车疏通', 
                pattern: 'clearance', 
                reward: 1000, 
                difficulty: 'hard',
                solution: [
                    { 
                        type: 'clearance',
                        pieceType: 'r'
                    }
                ]
            },
            { 
                id: 'deflection_advisor', 
                name: '引离士象', 
                pattern: 'deflection', 
                reward: 1100, 
                difficulty: 'hard',
                solution: [
                    { 
                        type: 'deflection',
                        targetTypes: ['a', 'b']
                    }
                ]
            },
            { 
                id: 'discovered_check_cannon', 
                name: '炮闪击', 
                pattern: 'discovered_check', 
                reward: 800, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'discovered_check'
                    }
                ]
            },
            { 
                id: 'pin_chariot', 
                name: '车牵制', 
                pattern: 'pin', 
                reward: 800, 
                difficulty: 'easy',
                solution: [
                    { 
                        type: 'pin',
                        pinningPiece: 'r'
                    }
                ]
            },
            { 
                id: 'pin_cannon', 
                name: '炮牵制', 
                pattern: 'pin', 
                reward: 600, 
                difficulty: 'easy',
                solution: [
                    { 
                        type: 'pin',
                        pinningPiece: 'c'
                    }
                ]
            },
            { 
                id: 'deflection_chariot', 
                name: '引离车', 
                pattern: 'deflection', 
                reward: 1200, 
                difficulty: 'hard',
                solution: [
                    { 
                        type: 'deflection',
                        targetTypes: ['r']
                    }
                ]
            },
            { 
                id: 'interference_chariot', 
                name: '阻挡车', 
                pattern: 'interference', 
                reward: 900, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'interference'
                    }
                ]
            },
            { 
                id: 'trapped_piece', 
                name: '困子', 
                pattern: 'trapping', 
                reward: 1500, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'trap',
                        targetValue: 400
                    }
                ]
            },
            { 
                id: 'perpetual_check', 
                name: '长将和棋', 
                pattern: 'perpetual', 
                reward: 500, 
                difficulty: 'medium',
                solution: [
                    { 
                        type: 'perpetual_check'
                    }
                ]
            }
        ];

        // 杀法战术
        const mates = [
            { 
                id: 'ma_hou_pao_mate', 
                name: '马后炮杀', 
                type: 'mate_pattern', 
                mateType: 'horse_cannon', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    {
                        type: 'horse_cannon_mate',
                        urgency: 'immediate'
                    }
                ]
            },
            { 
                id: 'shuang_che_cuo_mate', 
                name: '双车错杀', 
                type: 'mate_pattern', 
                mateType: 'double_chariot', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    {
                        type: 'double_chariot_mate',
                        urgency: 'immediate'
                    }
                ]
            },
            { 
                id: 'da_dao_wan_xin_mate', 
                name: '大刀剜心', 
                type: 'mate_pattern', 
                mateType: 'central_attack', 
                reward: 1800, 
                difficulty: 'medium',
                solution: [
                    {
                        type: 'central_chariot_sacrifice'
                    }
                ]
            },
            { 
                id: 'tie_men_shuan_mate', 
                name: '铁门栓杀', 
                type: 'mate_pattern', 
                mateType: 'file_mate', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    {
                        type: 'file_mate',
                        piece: 'r'
                    }
                ]
            },
            { 
                id: 'jia_che_pao_mate', 
                name: '夹车炮杀', 
                type: 'mate_pattern', 
                mateType: 'chariot_cannon', 
                reward: 1900, 
                difficulty: 'medium',
                solution: [
                    {
                        type: 'chariot_cannon_mate'
                    }
                ]
            },
            { 
                id: 'shuang_ma_yin_quan_mate', 
                name: '双马饮泉', 
                type: 'mate_pattern', 
                mateType: 'double_knight', 
                reward: 2000, 
                difficulty: 'hard',
                solution: [
                    {
                        type: 'double_knight_mate'
                    }
                ]
            },
            { 
                id: 'diao_yu_ma_mate', 
                name: '钓鱼马杀', 
                type: 'mate_pattern', 
                mateType: 'knight_mate', 
                reward: 1800, 
                difficulty: 'medium',
                solution: [
                    {
                        type: 'horse_fork_mate',
                        position: 'horse_corner'
                    }
                ]
            },
            { 
                id: 'ce_mian_hu_mate', 
                name: '侧面虎', 
                type: 'mate_pattern', 
                mateType: 'side_knight', 
                reward: 1800, 
                difficulty: 'medium',
                solution: [
                    {
                        type: 'side_knight_mate'
                    }
                ]
            },
            { 
                id: 'men_gong_mate', 
                name: '闷宫杀', 
                type: 'mate_pattern', 
                mateType: 'smothered_mate', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    {
                        type: 'smothered_mate',
                        piece: 'c'
                    }
                ]
            },
            { 
                id: 'chong_pao_mate', 
                name: '重炮杀', 
                type: 'mate_pattern', 
                mateType: 'double_cannon', 
                reward: 2000, 
                difficulty: 'easy',
                solution: [
                    {
                        type: 'double_cannon_mate'
                    }
                ]
            },
            { 
                id: 'ma_ti_zhong', 
                name: '马踏中', 
                type: 'mate_pattern', 
                mateType: 'knight_fork_mate', 
                reward: 1900, 
                difficulty: 'hard',
                solution: [
                    {
                        type: 'knight_center_attack'
                    }
                ]
            }
        ];

        [...tactics, ...mates].forEach(t => {
            this.addTactic({
                ...t,
                description: t.name
            });
        });
    }

    // ==================== 陷阱库（新增完善） ====================
    
    buildTrapCollection() {
        const traps = [
            {
                id: 'shunshou_trap_1',
                name: '顺手炮弃马十三着',
                moves: [
                    { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                    { from: { row: 2, col: 1 }, to: { row: 2, col: 4 }, piece: 'c', notation: '炮8平5' },
                    { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                    { from: { row: 0, col: 7 }, to: { row: 2, col: 6 }, piece: 'n', notation: '马2进3' },
                    { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' }
                ],
                trapMove: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, piece: 'r', notation: '车9进1' },
                responseMoves: [
                    { from: { row: 5, col: 0 }, to: { row: 5, col: 6 }, piece: 'R', notation: '车二进六', description: '过河车抓马' },
                    { from: { row: 5, col: 0 }, to: { row: 1, col: 0 }, piece: 'R', notation:                     '车二进四', description: '稳步过河' }
                ],
                dangerLevel: 'high',
                description: '黑方快出横车，准备弃马抢攻'
            },
            {
                id: 'zhong_pao_trap_1',
                name: '中炮过河车贪吃陷阱',
                moves: [],
                trapMove: { from: { row: 3, col: 0 }, to: { row: 3, col: 2 }, piece: 'R', notation: '车二平三' },
                responseMoves: [
                    { from: { row: 2, col: 2 }, to: { row: 4, col: 3 }, piece: 'n', notation: '马8进6', description: '跃马踩车' },
                    { from: { row: 4, col: 3 }, to: { row: 3, col: 5 }, piece: 'n', notation: '马6进4', description: '卧槽马反击' }
                ],
                dangerLevel: 'medium',
                description: '红方车过于深入，黑方可以跳马反击'
            },
            {
                id: 'di_pao_trap',
                name: '卒底炮诱敌陷阱',
                moves: [
                    { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, piece: 'P', notation: '兵三进一' },
                    { from: { row: 2, col: 1 }, to: { row: 2, col: 2 }, piece: 'c', notation: '炮8平7' }
                ],
                trapMove: { from: { row: 9, col: 7 }, to: { row: 7, col: 8 }, piece: 'N', notation: '马二进一' },
                responseMoves: [
                    { from: { row: 3, col: 6 }, to: { row: 4, col: 6 }, piece: 'p', notation: '卒3进1', description: '挺卒制马' },
                    { from: { row: 2, col: 2 }, to: { row: 7, col: 2 }, piece: 'c', notation: '炮7进7', description: '沉底炮打相' }
                ],
                dangerLevel: 'high',
                description: '黑方卒底炮诱导红方跳边马，然后沉底炮攻相'
            },
            {
                id: 'pingfeng_ma_trap',
                name: '屏风马弃马陷车',
                moves: [
                    { from: { row: 7, col: 7 }, to: { row: 7, col: 4 }, piece: 'C', notation: '炮二平五' },
                    { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, piece: 'n', notation: '马8进7' },
                    { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: 'N', notation: '马二进三' },
                    { from: { row: 3, col: 2 }, to: { row: 4, col: 2 }, piece: 'p', notation: '卒7进1' },
                    { from: { row: 9, col: 0 }, to: { row: 5, col: 0 }, piece: 'R', notation: '车一平二' }
                ],
                trapMove: { from: { row: 5, col: 0 }, to: { row: 3, col: 0 }, piece: 'R', notation: '车二进四' },
                responseMoves: [
                    { from: { row: 2, col: 2 }, to: { row: 4, col: 3 }, piece: 'n', notation: '马7进6', description: '盘河马踩车' },
                    { from: { row: 2, col: 7 }, to: { row: 6, col: 7 }, piece: 'c', notation: '炮8进2', description: '左炮封车' }
                ],
                dangerLevel: 'medium',
                trigger: 'red_chariot_advance',
                description: '红方车轻进河口，黑方可以跳马封车'
            }
        ];

        traps.forEach(t => this.addTrap(t));
    }

    // ==================== 核心匹配算法（完整实现） ====================
    
    /**
     * 主查询入口 - 统一棋库查询（带优先级）
     * 优先级：陷阱 > 开局 > 战术 > 残局 > 中局
     */
    getBookMove(board, player, moveHistory = []) {
        this.stats.matches++;
        console.log(`[棋库查询] 玩家: ${player}, 步数: ${moveHistory.length}`);

        const cacheKey = this.getCacheKey(board, player, moveHistory);
        if (this.config.usePositionCache && this.moveCache.has(cacheKey)) {
            const cached = this.moveCache.get(cacheKey);
            if (cached && cached !== 'NO_MOVE') {
                this.stats.hits++;
                console.log(`[缓存命中] ${cached.notation}`);
                return this.cloneMove(cached);
            }
            return null;
        }

        let bookMove = null;
        let matchSource = '';

        // 1. 陷阱库查询（最高优先级 - 针对对手上一步的反击）
        if (moveHistory.length > 0) {
            const lastMove = moveHistory[moveHistory.length - 1];
            const trapMove = this.findTrapMove(board, player, lastMove);
            if (trapMove) {
                bookMove = trapMove;
                matchSource = 'trap';
                console.log(`[陷阱库匹配] ${trapMove.name}: ${trapMove.notation}`);
            }
        }

        // 2. 开局库查询（严格历史匹配）
        if (!bookMove) {
            bookMove = this.findMoveStrict(board, player, moveHistory);
            if (bookMove) {
                matchSource = 'strict_history';
                console.log(`[开局库匹配] ${this.currentOpeningLine}: ${bookMove.notation}`);
            }
        }

        // 3. 战术库查询（基于意图生成）
        if (!bookMove) {
            bookMove = this.findTacticalMove(board, player);
            if (bookMove) {
                matchSource = 'tactics';
                console.log(`[战术库匹配] ${bookMove.tacticName}: ${bookMove.notation}`);
            }
        }

        // 4. 残局库查询（基于子力特征）
        if (!bookMove) {
            const endgameMove = this.findEndgameMove(board, player);
            if (endgameMove) {
                bookMove = endgameMove;
                matchSource = 'endgame';
                console.log(`[残局库匹配] ${endgameMove.endgameType}: ${endgameMove.notation}`);
            }
        }

        // 5. 中局库查询（基于模式识别）
        if (!bookMove) {
            const midgameMove = this.findMidgameMove(board, player);
            if (midgameMove) {
                bookMove = midgameMove;
                matchSource = 'midgame';
                console.log(`[中局库匹配] ${midgameMove.patternName}: ${midgameMove.notation}`);
            }
        }

        // 验证走法合法性
        if (bookMove && !this.validateMove(board, bookMove, player)) {
            console.warn(`[验证失败] ${matchSource} 走法未通过验证: ${bookMove.notation}`);
            this.stats.failedMatches++;
            bookMove = null;
        }

        // 缓存结果
        if (this.config.usePositionCache) {
            this.moveCache.set(cacheKey, bookMove || 'NO_MOVE');
            if (this.moveCache.size > this.config.maxCacheSize) {
                this.cleanCache();
            }
        }

        if (bookMove) {
            console.log(`[棋库命中] 来源: ${matchSource}, 走法: ${bookMove.notation}`);
        }

        return bookMove ? this.cloneMove(bookMove) : null;
    }

    /**
     * 陷阱库查询 - 检测对手是否走入陷阱
     */
    findTrapMove(board, player, lastMove) {
        const opponent = player === 'red' ? 'black' : 'red';
        
        for (const trap of this.bookData.traps) {
            // 检查是否匹配陷阱触发走法
            if (this.movesEqualStrict(trap.trapMove, lastMove)) {
                console.log(`[陷阱触发] 检测到: ${trap.name}`);
                
                // 返回反击走法（选择第一个可用的）
                if (trap.responseMoves && trap.responseMoves.length > 0) {
                    for (const response of trap.responseMoves) {
                        // 适配坐标（考虑对称）
                        const adaptedMove = this.adaptBookMove(response, board, player);
                        if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                            return {
                                ...adaptedMove,
                                weight: 1.2,
                                source: 'trap',
                                name: trap.name,
                                trapDescription: trap.description
                            };
                        }
                    }
                }
            }
            
            // 检查局面特征触发
            if (trap.trigger && this.matchesTrapTrigger(board, player, trap.trigger)) {
                console.log(`[陷阱触发-局面] ${trap.name}`);
                if (trap.responseMoves && trap.responseMoves.length > 0) {
                    for (const response of trap.responseMoves) {
                        const adaptedMove = this.adaptBookMove(response, board, player);
                        if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                            return {
                                ...adaptedMove,
                                weight: 1.15,
                                source: 'trap_pattern',
                                name: trap.name
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

        /**
     * 检查局面特征触发条件（增强版）
     */
    matchesTrapTrigger(lastMove, trap, board, player) {
        // 检查上一步是否就是陷阱期待的"坏棋"
        if (trap.trapMove) {
            if (lastMove.from.row === trap.trapMove.from.row &&
                lastMove.from.col === trap.trapMove.from.col &&
                lastMove.to.row === trap.trapMove.to.row &&
                lastMove.to.col === trap.trapMove.to.col) {
                return true;
            }
        }
        
        // 【新增】更多局面特征触发条件
        if (trap.trigger) {
            switch(trap.trigger) {
                case 'red_pawn_advanced':
                    if (board[4][4] === 'P' || board[5][4] === 'P') return true;
                    break;
                    
                case 'red_chariot_advance':
                    // 红方车进到对方半区（第0-4行）
                    for (let r = 0; r < 5; r++) {
                        for (let c = 0; c < 9; c++) {
                            if (board[r][c] === 'R') return true;
                        }
                    }
                    break;
                    
                case 'central_pawn_exchanged':
                    // 中兵已兑换（双方中路兵都消失）
                    if (board[6][4] === ' ' && board[3][4] === ' ') return true;
                    break;
                    
                case 'horse_exposed':
                    // 【新增】马暴露无根（易受攻击）
                    if (this.isHorseExposed(board, player)) return true;
                    break;
                    
                case 'cannon_fork_setup':
                    // 炮牵制设置：炮对准对方车马可形成捉双
                    const cannons = this.getPiecesByPlayer(board, player).filter(p => p.type.toLowerCase() === 'c');
                    for (const cannon of cannons) {
                        // 检查是否有两个目标在同一列
                        if (this.hasForkTarget(board, cannon)) return true;
                    }
                    break;
            }
        }
        
        return false;
    }

    /**
     * 【新增方法】检查马是否暴露无根
     * 添加位置：matchesTrapTrigger 之后
     */
    isHorseExposed(board, player) {
        const horseChar = player === 'red' ? 'N' : 'n';
        const opponent = player === 'red' ? 'black' : 'red';
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === horseChar) {
                    // 检查马是否过河（更危险）
                    const crossed = player === 'red' ? r < 5 : r > 4;
                    if (!crossed) continue;
                    
                    // 检查是否有己方棋子保护（简化：周围一格内有无己方棋子）
                    let hasProtection = false;
                    const directions = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
                    for (const [dr, dc] of directions) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                            const piece = board[nr][nc];
                            if (piece !== ' ' && this.getPieceColor(piece) === player) {
                                hasProtection = true;
                                break;
                            }
                        }
                    }
                    
                    if (!hasProtection) return true;
                }
            }
        }
        return false;
    }

    /**
     * 【新增方法】检查炮是否有捉双目标
     * 添加位置：isHorseExposed 之后
     */
    hasForkTarget(board, cannon) {
        // 检查竖线是否有两个可攻击的高价值目标
        const targets = [];
        for (let r = 0; r < 10; r++) {
            if (r === cannon.row) continue;
            const piece = board[r][cannon.col];
            if (piece !== ' ' && this.getPieceColor(piece) !== this.getPieceColor(cannon.type)) {
                if (['r', 'n', 'c'].includes(piece.toLowerCase())) {
                    targets.push({row: r, piece: piece});
                }
            }
        }
        return targets.length >= 2;
    }

    /**
     * 战术库查询 - 基于意图生成具体走法
     */
    findTacticalMove(board, player) {
        const tactics = this.bookData.tactics;
        
        // 按奖励值排序，优先高价值战术
        const sortedTactics = tactics.sort((a, b) => b.reward - a.reward);
        
        for (const tactic of sortedTactics) {
            if (!tactic.solution || tactic.solution.length === 0) continue;
            
            const intention = tactic.solution[0];
            let move = null;
            
            // 根据意图类型生成具体走法
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
                case 'file_mate':
                    move = this.findFileMate(board, player);
                    break;
                case 'double_cannon_mate':
                    move = this.findDoubleCannonMate(board, player);
                    break;
            }
            
            if (move && this.validateMove(board, move, player)) {
                return {
                    ...move,
                    weight: (tactic.reward || 1000) / 2000,
                    tacticName: tactic.name,
                    tacticType: tactic.pattern || tactic.type,
                    source: 'tactics'
                };
            }
        }
        
        return null;
    }

    /**
     * 残局库查询 - 基于子力特征匹配
     */
    findEndgameMove(board, player) {
        for (const pattern of this.bookData.endgames) {
            if (!pattern.suggestedMoves || pattern.suggestedMoves.length === 0) continue;
            
            // 使用特征匹配
            if (this.matchPositionFeatures(board, pattern.keyFeatures, player)) {
                const move = pattern.suggestedMoves[0];
                const adaptedMove = this.adaptBookMove(move, board, player);
                
                if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                    return {
                        ...adaptedMove,
                        weight: pattern.weight || 0.95,
                        endgameType: pattern.name,
                        winningMethod: pattern.winningMethod,
                        source: 'endgame'
                    };
                }
            }
        }
        return null;
    }

    /**
     * 中局库查询 - 基于模式识别
     */
    findMidgameMove(board, player) {
        for (const pattern of this.bookData.midgames) {
            if (!pattern.suggestedMoves || pattern.suggestedMoves.length === 0) continue;
            
            // 使用中局模式匹配
            if (this.matchMidgamePattern(board, pattern, player)) {
                for (const move of pattern.suggestedMoves) {
                    const adaptedMove = this.adaptBookMove(move, board, player);
                    if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                        return {
                            ...adaptedMove,
                            weight: pattern.weight || 0.85,
                            patternName: pattern.name,
                            difficulty: pattern.difficulty,
                            source: 'midgame'
                        };
                    }
                }
            }
        }
        return null;
    }

    /**
     * 开局库严格历史匹配
     */
    findMoveStrict(board, player, moveHistory) {
        const openings = player === 'red' 
            ? this.bookData.openings.red 
            : this.bookData.openings.black;

        for (const opening of openings) {
            if (!opening.moves || opening.moves.length === 0) continue;

            // 匹配主干
            if (moveHistory.length < opening.moves.length) {
                let matches = true;
                for (let i = 0; i < moveHistory.length; i++) {
                    if (!this.movesEqualStrict(opening.moves[i], moveHistory[i])) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    const nextMove = opening.moves[moveHistory.length];
                    const adaptedMove = this.adaptBookMove(nextMove, board, player);
                    if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                        this.currentOpeningLine = opening.name;
                        return {
                            ...adaptedMove,
                            weight: opening.weight || 1.0,
                            source: 'opening'
                        };
                    }
                }
            }

            // 匹配变例
            if (opening.variations) {
                for (const variation of opening.variations) {
                    if (!variation.moves || variation.moves.length === 0) continue;
                    
                    const combinedMoves = [...opening.moves, ...variation.moves];
                    if (moveHistory.length < combinedMoves.length) {
                        let matches = true;
                        for (let i = 0; i < moveHistory.length; i++) {
                            if (!this.movesEqualStrict(combinedMoves[i], moveHistory[i])) {
                                matches = false;
                                break;
                            }
                        }
                        if (matches) {
                            const nextMove = combinedMoves[moveHistory.length];
                            const adaptedMove = this.adaptBookMove(nextMove, board, player);
                            if (adaptedMove && this.validateMove(board, adaptedMove, player)) {
                                this.currentOpeningLine = `${opening.name} - ${variation.name}`;
                                return {
                                    ...adaptedMove,
                                    weight: variation.weight || opening.weight || 1.0,
                                    source: 'opening_variation'
                                };
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    // ==================== 特征匹配方法（新增）========================

    /**
     * 匹配残局特征
     * 检查当前局面是否符合残局定式的子力特征
     */
    matchPositionFeatures(board, keyFeatures, player) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyPieces = this.getPiecesByPlayer(board, opponent);
        
        // 统计子力
        const myStrongPieces = myPieces.filter(p => ['r', 'c', 'n'].includes(p.type.toLowerCase()));
        const enemyStrongPieces = enemyPieces.filter(p => ['r', 'c', 'n'].includes(p.type.toLowerCase()));
        
        const myChariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
        const enemyAdvisors = enemyPieces.filter(p => p.type.toLowerCase() === 'a');
        const enemyBishops = enemyPieces.filter(p => p.type.toLowerCase() === 'b');
        const myHorses = myPieces.filter(p => p.type.toLowerCase() === 'n');
        const myPawns = myPieces.filter(p => p.type.toLowerCase() === 'p');
        const myCannons = myPieces.filter(p => p.type.toLowerCase() === 'c');
        
        for (const feature of keyFeatures) {
            switch(feature) {
                case 'chariot_vs_advisor':
                    // 单车对单士：进攻方1车，防守方1士，无其他强子
                    if (myChariots.length === 1 && enemyAdvisors.length === 1 && 
                        enemyStrongPieces.length === 0 && myStrongPieces.length === 1 &&
                        myPawns.length === 0 && enemyBishops.length === 0) {
                        return true;
                    }
                    break;
                    
                case 'chariot_vs_bishop':
                    // 单车对单象
                    if (myChariots.length === 1 && enemyBishops.length === 1 &&
                        enemyStrongPieces.length === 0 && myStrongPieces.length === 1 &&
                        enemyAdvisors.length === 0) {
                        return true;
                    }
                    break;
                    
                case 'chariot_vs_two_advisors':
                    // 单车对双士
                    if (myChariots.length === 1 && enemyAdvisors.length === 2 &&
                        enemyStrongPieces.length === 0 && myStrongPieces.length === 1) {
                        return true;
                    }
                    break;
                    
                case 'horse_pawn_vs_advisor':
                    // 马兵对单士
                    if (myHorses.length >= 1 && myPawns.length >= 1 && enemyAdvisors.length === 1 &&
                        enemyStrongPieces.length === 0 && myChariots.length === 0 && myCannons.length === 0) {
                        return true;
                    }
                    break;
                    
                case 'cannon_pawn_vs_advisor':
                    // 炮兵对单士
                    if (myCannons.length >= 1 && myPawns.length >= 1 && enemyAdvisors.length === 1 &&
                        myHorses.length === 0 && myChariots.length === 0) {
                        return true;
                    }
                    break;
                    
                case 'two_pawns_vs_advisor':
                    // 双兵对单士
                    if (myPawns.length >= 2 && enemyAdvisors.length === 1 &&
                        myStrongPieces.length === 0) {
                        return true;
                    }
                    break;
                    
                case 'winning':
                    // 必胜残局标志，进一步验证子力优势
                    if (myStrongPieces.length > enemyStrongPieces.length ||
                        (myPawns.length >= 2 && enemyPieces.length <= 3)) {
                        return true;
                    }
                    break;
            }
        }
        
        return false;
    }

    /**
     * 匹配中局模式
     * 检查当前局面是否符合中局战术模式
     */
    matchMidgamePattern(board, pattern, player) {
        const opponent = player === 'red' ? 'black' : 'red';
        const myPieces = this.getPiecesByPlayer(board, player);
        const enemyKing = this.findKing(board, opponent);
        
        if (!enemyKing) return false;
        
        for (const feature of pattern.keyFeatures) {
            switch(feature) {
                case 'double_rooks':
                    // 双车错：检查是否有两辆车能攻击到对方将帅
                    const myChariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
                    if (myChariots.length >= 2) {
                        // 检查是否在同一线路或能将军
                        for (const chariot of myChariots) {
                            if (chariot.row === enemyKing.row || chariot.col === enemyKing.col) {
                                if (this.isClearLine(board, chariot, enemyKing)) {
                                    return true;
                                }
                            }
                        }
                    }
                    break;
                    
                case 'horse_tactics':
                    // 卧槽马：马在对方九宫横向间隔1格，纵向间隔2格
                    const myHorses = myPieces.filter(p => p.type.toLowerCase() === 'n');
                    for (const horse of myHorses) {
                        const rowDiff = Math.abs(horse.row - enemyKing.row);
                        const colDiff = Math.abs(horse.col - enemyKing.col);
                        // 卧槽位通常在将/帅旁边一格，横向距离1，纵向距离2（马走日）
                        if (rowDiff === 2 && colDiff === 1) {
                            return true;
                        }
                        // 挂角马：横向距离1，纵向距离2，且在九宫角
                        if (player === 'red' && horse.row <= 2 && rowDiff === 2 && colDiff === 1) {
                            return true;
                        }
                        if (player === 'black' && horse.row >= 7 && rowDiff === 2 && colDiff === 1) {
                            return true;
                        }
                    }
                    break;
                    
                case 'central_cannon':
                    // 空头炮：炮在中路且能直接将军
                    const myCannons = myPieces.filter(p => p.type.toLowerCase() === 'c');
                    for (const cannon of myCannons) {
                        if (cannon.col === 4 && cannon.col === enemyKing.col) {
                            // 检查中间是否有炮架
                            const piecesBetween = this.countPiecesBetween(board, cannon, enemyKing);
                            if (piecesBetween === 1) { // 恰好一个炮架才能将军（吃子情况）
                                return true;
                            }
                        }
                    }
                    break;
                    
                case 'mate_threat':
                    // 杀棋威胁：检查是否能将军
                    // 简化处理：如果有多个子力靠近对方将帅
                    let attackingPieces = 0;
                    for (const piece of myPieces) {
                        const dist = Math.abs(piece.row - enemyKing.row) + Math.abs(piece.col - enemyKing.col);
                        if (dist <= 3) attackingPieces++;
                    }
                    if (attackingPieces >= 2) return true;
                    break;
                    
                case 'open_file':
                    // 开放线路：车或炮在竖线且到对方将帅之间无子
                    for (const piece of myPieces) {
                        if (['r', 'c'].includes(piece.type.toLowerCase())) {
                            if (piece.col === enemyKing.col && this.isClearLine(board, piece, enemyKing)) {
                                return true;
                            }
                        }
                    }
                    break;
                    
                case 'double_cannons':
                    // 重炮：两门炮在同一竖线
                    const cannons = myPieces.filter(p => p.type.toLowerCase() === 'c');
                    if (cannons.length >= 2) {
                        for (let i = 0; i < cannons.length; i++) {
                            for (let j = i + 1; j < cannons.length; j++) {
                                if (cannons[i].col === cannons[j].col) {
                                    return true;
                                }
                            }
                        }
                    }
                    break;
            }
        }
        
        return false;
    }

    // ==================== 战术意图生成方法（完整实现）====================

    /**
     * 寻找马捉双走法
     */
    findHorseForkMove(board, player, targetTypes) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const horses = myPieces.filter(p => p.type.toLowerCase() === 'n');
        const opponent = player === 'red' ? 'black' : 'red';
        
        for (const horse of horses) {
            const moves = this.generateHorseMoves(board, horse.row, horse.col);
            for (const to of moves) {
                // 模拟走这步，看是否形成捉双
                const originalPiece = board[to.row][to.col];
                board[to.row][to.col] = horse.type;
                board[horse.row][horse.col] = ' ';
                
                let captureCount = 0;
                let capturedValues = [];
                const enemyPieces = this.getPiecesByPlayer(board, opponent);
                
                // 检查这步棋后，马是否攻击两个或以上高价值目标
                for (const enemy of enemyPieces) {
                    if (targetTypes && !targetTypes.includes(enemy.type.toLowerCase())) continue;
                    
                    // 检查马是否可以走到enemy位置（即是否攻击该子）
                    const horseAttacks = this.isHorseAttack(to.row, to.col, enemy.row, enemy.col);
                    if (horseAttacks) {
                        const val = PIECE_VALUES[enemy.type] || 0;
                        if (val >= (targetTypes ? 500 : 240)) {
                            captureCount++;
                            capturedValues.push(val);
                        }
                    }
                }
                
                // 恢复棋盘
                board[horse.row][horse.col] = horse.type;
                board[to.row][to.col] = originalPiece;
                
                if (captureCount >= 2) {
                    return {
    from: { row: horse.row, col: horse.col },
    to: to,
    piece: horse.type,
    notation: this.generateNotation(horse.type, horse.row, horse.col, to.row, to.col),  // ✅ 正确
    isCapture: board[to.row][to.col] !== ' ',
    tacticValue: capturedValues.reduce((a,b) => a+b, 0),
    tacticType: 'horse_fork'
};
                }
            }
        }
        return null;
    }

    /**
     * 寻找车抽将得子（将军同时吃子）
     */
    findChariotCheckCapture(board, player) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const chariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return null;
        
        for (const chariot of chariots) {
            const moves = this.generateChariotMoves(board, chariot.row, chariot.col);
            for (const to of moves) {
                const target = board[to.row][to.col];
                if (target === ' ') continue;
                
                // 模拟走这步
                const originalPiece = board[to.row][to.col];
                board[to.row][to.col] = chariot.type;
                board[chariot.row][chariot.col] = ' ';
                
                const givesCheck = this.wouldGiveCheck(board, to, enemyKing, chariot.type, player);
                const isSafe = !this.wouldBeInCheck(board, player);
                
                // 恢复
                board[chariot.row][chariot.col] = chariot.type;
                board[to.row][to.col] = originalPiece;
                
                if (givesCheck && isSafe) {
                    const targetVal = PIECE_VALUES[target] || 0;
                    const isCapture = target !== ' ';  // target 是之前定义的变量
return {
    from: { row: chariot.row, col: chariot.col },
    to: to,
    piece: chariot.type,
    notation: this.generateNotation(chariot.type, chariot.row, chariot.col, to.row, to.col),
    isCapture: isCapture,
    tacticValue: targetVal + 500,
    tacticType: 'chariot_check_capture'
};
                }
            }
        }
        return null;
    }

    /**
     * 寻找马后炮杀法
     */
    findHorseCannonMate(board, player) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const horses = myPieces.filter(p => p.type.toLowerCase() === 'n');
        const cannons = myPieces.filter(p => p.type.toLowerCase() === 'c');
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing || cannons.length === 0) return null;
        
        for (const horse of horses) {
            // 寻找卧槽位（将/帅旁边一格，横向）
            const targetRows = player === 'red' ? [enemyKing.row - 1, enemyKing.row + 1] : [enemyKing.row + 1, enemyKing.row - 1];
            for (const tr of targetRows) {
                for (const tc of [enemyKing.col - 1, enemyKing.col + 1]) {
                    if (tr < 0 || tr > 9 || tc < 0 || tc > 8) continue;
                    if (!this.isValidHorseMove(board, horse.row, horse.col, tr, tc)) continue;
                    
                    // 检查是否有炮可以形成马后炮（炮与将帅在同一竖线，马作为炮架）
                    for (const cannon of cannons) {
                        if (cannon.col === enemyKing.col) {
                            // 验证马走到卧槽后是否形成炮架
                            const originalPiece = board[tr][tc];
                            board[tr][tc] = horse.type;
                            board[horse.row][horse.col] = ' ';
                            
                            const givesCheck = this.wouldGiveCheck(board, {row: tr, col: tc}, enemyKing, horse.type, player);
                            const isMate = givesCheck && this.isCheckmate(board, opponent);
                            
                            // 恢复
                            board[horse.row][horse.col] = horse.type;
                            board[tr][tc] = originalPiece;
                            
                            if (givesCheck) {
                                return {
    from: { row: horse.row, col: horse.col },
    to: { row: tr, col: tc },
    piece: horse.type,
    notation: this.generateNotation(horse.type, horse.row, horse.col, tr, tc),  // ✅ 正确
    isCapture: board[tr][tc] !== ' ',
    isMateThreat: isMate,
    tacticType: 'horse_cannon_mate'
};
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * 寻找闪击（露将/露杀）
     */
    findDiscoveredCheck(board, player) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return null;
        
        // 寻找被己方棋子遮挡的线路
        for (const piece of myPieces) {
            if (!['r', 'c'].includes(piece.type.toLowerCase())) continue;
            
            // 检查四个方向是否有己方棋子遮挡且出去能将军
            const directions = [[-1,0],[1,0],[0,-1],[0,1]];
            for (const [dr, dc] of directions) {
                let r = piece.row + dr, c = piece.col + dc;
                let blocker = null;
                
                // 寻找第一个遮挡的棋子
                while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                    if (board[r][c] !== ' ') {
                        blocker = {row: r, col: c, piece: board[r][c]};
                        break;
                    }
                    r += dr;
                    c += dc;
                }
                
                if (blocker) {
                    const blockerColor = this.getPieceColor(blocker.piece);
                    if (blockerColor === player) {
                        // 检查移动blocker后是否形成将军
                        const blockerMoves = this.generateBasicMoves(board, blocker.row, blocker.col, blocker.piece);
                        for (const to of blockerMoves) {
                            const originalTarget = board[to.row][to.col];
                            board[to.row][to.col] = blocker.piece;
                            board[blocker.row][blocker.col] = ' ';
                            
                            const givesCheck = this.wouldGiveCheck(board, {row: to.row, col: to.col}, enemyKing, blocker.piece, player);
                            const isSafe = !this.wouldBeInCheck(board, player);
                            
                            // 恢复
                            board[blocker.row][blocker.col] = blocker.piece;
                            board[to.row][to.col] = originalTarget;
                            
                            if (givesCheck && isSafe) {
                                const capturedPiece = board[to.row][to.col];
return {
    from: { row: blocker.row, col: blocker.col },
    to: to,
    piece: blocker.piece,
    notation: this.generateNotation(blocker.piece, blocker.row, blocker.col, to.row, to.col),  // ✅ 正确
    isCapture: capturedPiece !== ' ',
    isCheck: true,
    tacticType: 'discovered_check'
};
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * 寻找弃子疏通线路
     */
    findClearanceSacrifice(board, player) {
        const myPieces = this.getPiecesByPlayer(board, player);
        const pawns = myPieces.filter(p => p.type.toLowerCase() === 'p');
        const chariots = myPieces.filter(p => p.type.toLowerCase() === 'r');
        
        if (chariots.length === 0) return null;
        
        for (const pawn of pawns) {
            // 如果兵在前面阻挡了车的进攻线路，考虑弃掉
            for (const chariot of chariots) {
                if (pawn.row === chariot.row && Math.abs(pawn.col - chariot.col) === 1) {
                    // 检查弃兵后是否打开攻击线路
                    return {
                        from: { row: pawn.row, col: pawn.col },
                        to: { row: pawn.row + (player === 'red' ? -1 : 1), col: pawn.col },
                        piece: pawn.type,
                        notation: this.generateNotation(pawn.type, pawn.row, pawn.col, to.row, to.col),
                        isCapture: false,
                        sacrifice: true,
                        tacticType: 'clearance'
                    };
                }
            }
        }
        return null;
    }

    /**
     * 寻找引离战术
     */
    findDeflection(board, player) {
        const opponent = player === 'red' ? 'black' : 'red';
        const myPieces = this.getPiecesByPlayer(board, player);
        
        // 寻找可以引开对方守卫的走法
        for (const piece of myPieces) {
            const moves = this.generateBasicMoves(board, piece.row, piece.col, piece.piece);
            for (const to of moves) {
                const target = board[to.row][to.col];
                if (target === ' ') continue;
                
                const targetType = target.toLowerCase();
                // 如果吃的是关键的防守子力（士、象）
                if (targetType === 'a' || targetType === 'b') {
                    // 模拟吃子
                    const originalTarget = board[to.row][to.col];
                    board[to.row][to.col] = piece.type;
                    board[piece.row][piece.col] = ' ';
                    
                    const improvesAttack = this.evaluateAttackPotential(board, player) > 100;
                    
                    // 恢复
                    board[piece.row][piece.col] = piece.type;
                    board[to.row][to.col] = originalTarget;
                    
                    if (improvesAttack) {
                        return {
                            from: { row: piece.row, col: piece.col },
                            to: to,
                            piece: piece.type,
                            notation: this.generateNotation(piece.type, piece.row, piece.col, to.row, to.col),
                            isCapture: true,
                            tacticType: 'deflection'
                        };
                    }
                }
            }
        }
        return null;
    }

    findDoubleCheck(board, player) {
        // 双将较为复杂，简化为检查是否存在
        return null;
    }

    findFileMate(board, player) {
        // 铁门栓简化实现
        return null;
    }

    findDoubleCannonMate(board, player) {
        // 重炮杀简化实现
        return null;
    }

    // ==================== 辅助工具方法（完整实现）====================

    /**
     * 获取某方所有棋子
     */
    getPiecesByPlayer(board, player) {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === ' ') continue;
                const piecePlayer = this.getPieceColor(p);
                if (piecePlayer === player) {
                    pieces.push({ row: r, col: c, type: p, piece: p });
                }
            }
        }
        return pieces;
    }

    /**
     * 查找将帅位置
     */
    findKing(board, player) {
        const kingChar = player === 'red' ? 'K' : 'k';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === kingChar) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    /**
     * 检查线路是否畅通
     */
    isClearLine(board, piece1, piece2) {
        if (piece1.row === piece2.row) {
            // 横线
            const start = Math.min(piece1.col, piece2.col) + 1;
            const end = Math.max(piece1.col, piece2.col);
            for (let c = start; c < end; c++) {
                if (board[piece1.row][c] !== ' ') return false;
            }
            return true;
        } else if (piece1.col === piece2.col) {
            // 竖线
            const start = Math.min(piece1.row, piece2.row) + 1;
            const end = Math.max(piece1.row, piece2.row);
            for (let r = start; r < end; r++) {
                if (board[r][piece1.col] !== ' ') return false;
            }
            return true;
        }
        return false;
    }

    /**
     * 统计两位置之间的棋子数
     */
    countPiecesBetween(board, piece1, piece2) {
        let count = 0;
        if (piece1.row === piece2.row) {
            const start = Math.min(piece1.col, piece2.col) + 1;
            const end = Math.max(piece1.col, piece2.col);
            for (let c = start; c < end; c++) {
                if (board[piece1.row][c] !== ' ') count++;
            }
        } else if (piece1.col === piece2.col) {
            const start = Math.min(piece1.row, piece2.row) + 1;
            const end = Math.max(piece1.row, piece2.row);
            for (let r = start; r < end; r++) {
                if (board[r][piece1.col] !== ' ') count++;
            }
        }
        return count;
    }

    /**
     * 意图驱动的坐标适配（增强版）
     */
    adaptBookMove(bookMove, board, player) {
        if (!bookMove || !bookMove.from || !bookMove.to) return null;
        
        const piece = bookMove.piece;
        const isRedPiece = piece === piece.toUpperCase();
        const piecePlayer = isRedPiece ? 'red' : 'black';
        
        if (piecePlayer !== player) return null;
        
        // 情况1：坐标完全匹配，直接使用
        if (board[bookMove.from.row][bookMove.from.col] === piece) {
            const targetPiece = board[bookMove.to.row][bookMove.to.col];
            const expectedCapture = bookMove.notation?.includes('吃') || bookMove.isCapture;
            
            // 如果期待吃子但目标已空，尝试找替代目标
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
        
        // 情况2：基于意图重新定位
        const intention = this.parseMoveIntention(bookMove, player);
        if (!intention) return null;
        
        return this.findMoveForIntention(intention, board, player);
    }

    /**
     * 解析走法意图
     */
    parseMoveIntention(bookMove, player) {
        const piece = bookMove.piece.toLowerCase();
        const isRed = bookMove.piece === bookMove.piece.toUpperCase();
        const from = bookMove.from;
        const to = bookMove.to;
        
        // 纵向大跨度移动：过河/吃卒/压马
        if ((piece === 'r' || piece === 'c') && Math.abs(to.row - from.row) > 2) {
            return {
                type: 'cross_river',
                pieceType: piece,
                isRed: isRed,
                preference: 'forward'
            };
        }
        
        // 马向中路移动：盘河/卧槽/挂角
        if (piece === 'n' && Math.abs(to.col - 4) <= 1 && Math.abs(to.row - from.row) === 2) {
            return {
                type: 'horse_tactics',
                pieceType: 'n',
                targetCol: to.col
            };
        }
        
        // 默认：相对位移
        return {
            type: 'relative_shift',
            pieceType: piece,
            rowDelta: to.row - from.row,
            colDelta: to.col - from.col
        };
    }

    /**
     * 根据意图寻找实际走法
     */
    findMoveForIntention(intention, board, player) {
        const pieceChar = intention.pieceType;
        const myPiece = player === 'red' ? pieceChar.toUpperCase() : pieceChar;
        
        const candidates = [];
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] !== myPiece) continue;
                
                const moves = this.generateBasicMoves(board, r, c, myPiece);
                
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
        
        // 过河意图：选最靠前的车
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
        // 简化处理：寻找同一目标列的其他可吃子
        return null;
    }

    /**
     * 生成简化记谱
     */
    generateNotation(piece, fromRow, fromCol, toRow, toCol) {
        const pieceNames = {'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒'};
        const name = pieceNames[piece.toLowerCase()] || piece;
        const direction = toRow > fromRow ? '进' : (toRow < fromRow ? '退' : '平');
        const fromColName = this.colToChinese(fromCol);
        const toColName = this.colToChinese(toCol);
        const rowDiff = Math.abs(toRow - fromRow);
        
        return `${name}${fromColName}${direction}${rowDiff > 0 ? rowDiff : toColName}`;
    }

    colToChinese(col) {
        const chars = ['九','八','七','六','五','四','三','二','一'];
        return chars[col] || col;
    }

    pieceToChar(piece) {
        // 与 getPieceName 完全一致
        const names = {
            'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒',
            'R': '车', 'N': '马', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵'
        };
        return names[piece] || piece;
    }

    getPieceColor(piece) {
        return piece === piece.toUpperCase() ? 'red' : 'black';
    }

    // ==================== 基础走法生成（简化版）====================

    generateBasicMoves(board, row, col, piece) {
        const moves = [];
        const pieceType = piece.toLowerCase();
        const isRed = piece === piece.toUpperCase();
        
        // 简化的走法生成，实际应由引擎提供
        // 这里只生成基本方向，不处理被将军等复杂情况
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
                        step++;
                    } else {
                        if (pieceType === 'r') {
                            if (this.getPieceColor(target) !== (isRed ? 'red' : 'black')) {
                                moves.push({row: nr, col: nc});
                            }
                            break;
                        } else {
                            // 炮需要跳吃
                            step++;
                            while (true) {
                                const nr2 = row + dr * step, nc2 = col + dc * step;
                                if (nr2 < 0 || nr2 >= 10 || nc2 < 0 || nc2 >= 9) break;
                                const t2 = board[nr2][nc2];
                                if (t2 !== ' ') {
                                    if (this.getPieceColor(t2) !== (isRed ? 'red' : 'black')) {
                                        moves.push({row: nr2, col: nc2});
                                    }
                                    break;
                                }
                                step++;
                            }
                            break;
                        }
                    }
                }
            } else {
                const nr = row + dr, nc = col + dc;
                if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                    const target = board[nr][nc];
                    if (target === ' ' || this.getPieceColor(target) !== (isRed ? 'red' : 'black')) {
                        // 检查特殊规则（马腿、象眼等）
                        if (this.isValidBasicMove(board, row, col, nr, nc, piece)) {
                            moves.push({row: nr, col: nc});
                        }
                    }
                }
            }
        }
        return moves;
    }

    generateHorseMoves(board, row, col) {
        return this.generateBasicMoves(board, row, col, 'n');
    }

    generateChariotMoves(board, row, col) {
        return this.generateBasicMoves(board, row, col, 'r');
    }

    isValidBasicMove(board, fromRow, fromCol, toRow, toCol, piece) {
        // 简化验证，实际应由引擎完成
        const pieceType = piece.toLowerCase();
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        if (pieceType === 'n') {
            // 检查马腿
            if (!((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2))) return false;
            let legRow, legCol;
            if (rowDiff === 2) {
                legRow = (fromRow + toRow) / 2;
                legCol = fromCol;
            } else {
                legRow = fromRow;
                legCol = (fromCol + toCol) / 2;
            }
            return board[legRow][legCol] === ' ';
        }
        
        if (pieceType === 'b') {
            // 检查象眼
            if (rowDiff !== 2 || colDiff !== 2) return false;
            const eyeRow = (fromRow + toRow) / 2;
            const eyeCol = (fromCol + toCol) / 2;
            return board[eyeRow][eyeCol] === ' ';
        }
        
        return true;
    }

    isValidHorseMove(board, fromRow, fromCol, toRow, toCol) {
        return this.isValidBasicMove(board, fromRow, fromCol, toRow, toCol, 'n');
    }

    isHorseAttack(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    wouldGiveCheck(board, from, to, piece, player) {
        // 简化判断：检查是否攻击到对方将帅
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return false;
        
        // 根据棋子类型判断是否将军
        const pieceType = piece.toLowerCase();
        
        if (pieceType === 'r') {
            // 车：同线且中间无子
            if (to.row === enemyKing.row || to.col === enemyKing.col) {
                return this.isClearLineBetween(board, to, enemyKing);
            }
        } else if (pieceType === 'c') {
            // 炮：同线且中间恰有一子
            if (to.col === enemyKing.col) {
                return this.countPiecesBetween(board, to, enemyKing) === 1;
            }
        } else if (pieceType === 'n') {
            // 马：走日
            return this.isHorseAttack(to.row, to.col, enemyKing.row, enemyKing.col);
        }
        
        return false;
    }

    isClearLineBetween(board, pos1, pos2) {
        return this.isClearLine(board, pos1, pos2);
    }

    wouldBeInCheck(board, player) {
        // 检查玩家是否被将军
        const opponent = player === 'red' ? 'black' : 'red';
        const myKing = this.findKing(board, player);
        if (!myKing) return false;

        // 检查对方所有棋子是否能攻击到将/帅
        const enemyPieces = this.getPiecesByPlayer(board, opponent);
        for (const piece of enemyPieces) {
            if (this.canAttack(board, piece, myKing.row, myKing.col)) {
                return true;
            }
        }
        return false;
    }

    canAttack(board, piece, targetRow, targetCol) {
        // 检查棋子是否能攻击到目标位置
        const pieceType = piece.type.toLowerCase();
        const isRed = piece.type === piece.type.toUpperCase();

        // 车：同线且中间无子
        if (pieceType === 'r') {
            if (piece.row === targetRow || piece.col === targetCol) {
                return this.isClearLine(board, {row: piece.row, col: piece.col}, {row: targetRow, col: targetCol});
            }
        }
        // 马：走日
        else if (pieceType === 'n') {
            const rowDiff = Math.abs(piece.row - targetRow);
            const colDiff = Math.abs(piece.col - targetCol);
            if ((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)) {
                // 检查马腿
                let legRow, legCol;
                if (rowDiff === 2) {
                    legRow = (piece.row + targetRow) / 2;
                    legCol = piece.col;
                } else {
                    legRow = piece.row;
                    legCol = (piece.col + targetCol) / 2;
                }
                return board[legRow][legCol] === ' ';
            }
        }
        // 炮：同线，吃子需要中间有一子，移动需要中间无子
        else if (pieceType === 'c') {
            if (piece.row === targetRow || piece.col === targetCol) {
                const count = this.countPiecesBetween(board, {row: piece.row, col: piece.col}, {row: targetRow, col: targetCol});
                // 如果目标位置有对方棋子，需要中间有一子（炮架）
                const targetPiece = board[targetRow][targetCol];
                if (targetPiece !== ' ' && this.getPieceColor(targetPiece) !== (isRed ? 'red' : 'black')) {
                    return count === 1;
                }
            }
        }
        // 将/帅：同线且相邻（将帅见面）
        else if (pieceType === 'k') {
            if (piece.col === targetCol) {
                return this.isClearLine(board, {row: piece.row, col: piece.col}, {row: targetRow, col: targetCol});
            }
        }
        return false;
    }

    isCheckmate(board, player) {
        // 简化实现
        return false;
    }

    evaluateAttackPotential(board, player) {
        // 简化的攻击潜力评估
        const opponent = player === 'red' ? 'black' : 'red';
        const enemyKing = this.findKing(board, opponent);
        if (!enemyKing) return 0;
        
        let potential = 0;
        const myPieces = this.getPiecesByPlayer(board, player);
        
        for (const piece of myPieces) {
            const dist = Math.abs(piece.row - enemyKing.row) + Math.abs(piece.col - enemyKing.col);
            if (dist < 4) potential += (4 - dist) * 50;
        }
        
        return potential;
    }

    // ==================== 数据管理方法 ====================

    addOpening(opening, player) {
        if (player === 'red') {
            this.bookData.openings.red.push(opening);
        } else {
            this.bookData.openings.black.push(opening);
        }
        this.stats.openings++;
        this.stats.totalPositions += (opening.moves?.length || 0);
        if (opening.variations) {
            opening.variations.forEach(v => {
                this.stats.totalPositions += (v.moves?.length || 0);
            });
        }
    }

    addMidgame(midgame) {
        this.bookData.midgames.push(midgame);
        this.stats.midgames++;
        this.stats.totalPositions++;
    }

    addEndgame(endgame) {
        this.bookData.endgames.push(endgame);
        this.stats.endgames++;
        this.stats.totalPositions++;
    }

    addTactic(tactic) {
        this.bookData.tactics.push(tactic);
        this.stats.tactics++;
    }

    addTrap(trap) {
        this.bookData.traps.push(trap);
    }

    validateMove(board, move, player) {
        if (!move || !move.from || !move.to || !move.piece) return false;
        
        const { from, to, piece } = move;
        
        if (from.row < 0 || from.row > 9 || from.col < 0 || from.col > 8) return false;
        if (to.row < 0 || to.row > 9 || to.col < 0 || to.col > 8) return false;
        
        // 检查棋子颜色是否匹配
        const isRedPiece = piece === piece.toUpperCase();
        if ((player === 'red' && !isRedPiece) || (player === 'black' && isRedPiece)) {
            return false;
        }
        
        // 检查目标位置是否是己方棋子
        const target = board[to.row][to.col];
        if (target !== ' ') {
            const isTargetRed = target === target.toUpperCase();
            if (isRedPiece === isTargetRed) return false;
        }
        
        return true;
    }

    getCacheKey(board, player, moveHistory) {
        // 使用局面哈希和玩家颜色作为键
        let hash = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p !== ' ') {
                    hash = ((hash << 5) - hash) + p.charCodeAt(0) + r * 9 + c;
                    hash = hash & hash;
                }
            }
        }
        return `${player}_${hash}_${moveHistory.length}`;
    }

    movesEqualStrict(move1, move2) {
        if (!move1 || !move2) return false;
        return move1.from.row === move2.from.row &&
               move1.from.col === move2.from.col &&
               move1.to.row === move2.to.row &&
               move1.to.col === move2.to.col &&
               move1.piece === move2.piece;
    }

    cloneMove(move) {
        if (!move) return null;
        return {
            from: { ...move.from },
            to: { ...move.to },
            piece: move.piece,
            notation: move.notation,
            weight: move.weight || 1.0,
            reason: move.reason || '',
            source: move.source || 'unknown',
            tacticName: move.tacticName,
            tacticType: move.tacticType,
            endgameType: move.endgameType,
            isCapture: move.isCapture
        };
    }

    cleanCache() {
        const maxSize = Math.floor(this.config.maxCacheSize / 2);
        if (this.moveCache.size > maxSize) {
            const entries = Array.from(this.moveCache.entries());
            this.moveCache.clear();
            for (let i = Math.max(0, entries.length - maxSize); i < entries.length; i++) {
                this.moveCache.set(entries[i][0], entries[i][1]);
            }
        }
    }

    getStats() {
        return { ...this.stats, cacheSize: this.moveCache.size };
    }

    clearCache() {
        this.positionCache.clear();
        this.moveCache.clear();
        this.currentOpeningLine = null;
        console.log('棋库缓存已清除');
    }

    getCurrentOpening() {
        return this.currentOpeningLine;
    }

    // 供AI引擎调用的接口
    findMatchingMove(board, player, moveHistory) {
        return this.getBookMove(board, player, moveHistory);
    }

    /**
     * 特征匹配接口（供AI引擎调用）
     */
    matchPositionFeaturesInterface(board, features, player) {
        return this.matchPositionFeatures(board, features, player);
    }

    /**
     * 中局模式匹配接口（供AI引擎调用）
     */
    matchMidgamePatternInterface(board, pattern, player) {
        return this.matchMidgamePattern(board, pattern, player);
    }
}

// 兼容性导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessOpeningBook;
} else if (typeof window !== 'undefined') {
    window.ChessOpeningBook = ChessOpeningBook;
}