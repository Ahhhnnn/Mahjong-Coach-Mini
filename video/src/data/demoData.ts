export const DEMO_PUZZLE = {
  chapter: '第 2 章 · 五搭整理入门',
  title: '六搭超载 · 舍弱留强',
  variant: '血战到底 · 缺万门清',
  hand: ['2p', '3p', '4p', '5p', '6p', '8p', '8p', '1s', '2s', '4s', '5s', '7s', '8s', '9s'] as const,
  discardIndex: 7, // '1s'
  bestDiscard: '1s',
  bestLabel: '一条',
  shanten: 1,
  bestUkeireTotal: 19,
  waits: [
    { tile: '1p', count: 4 },
    { tile: '4p', count: 3 },
    { tile: '7p', count: 4 },
    { tile: '3s', count: 4 },
    { tile: '6s', count: 4 },
  ],
  comparisons: [
    { tile: '1s', label: '打 一条（拆边张弱搭）', ukeire: 19, shanten: '1 向听', tag: '最优解', optimal: true },
    { tile: '4s', label: '打 四条（误拆两面搭）', ukeire: 15, shanten: '1 向听', tag: '少 4 张', optimal: false },
    { tile: '2p', label: '打 二筒（破坏五连形）', ukeire: 8, shanten: '1 向听', tag: '少 11 张', optimal: false },
  ],
  chapters: [
    '对子定将与拆搭',
    '五搭整理入门',
    '口诀真假鉴别',
    '长连与冗余张',
    '单碰后的牌效',
    '高压门清',
    '双碰残局',
    '综合收官',
  ],
}

export const DEMO_COACHES = [
  {
    id: 'hehe',
    name: '青竹教练',
    role: '温和耐心的陪练老师',
    avatar: 'assets/coach/hehe.jpg',
    accent: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.14)',
    question: '为什么这手优先打一条，不先拆四五条？',
    answer:
      '手牌已有六搭，必须去掉最弱的一搭。1-2条是边张只进3条；留下 2-6筒五连形与 4-5条两面，总进张高达 19 张，下巡摸到 1/4/7筒或 3/6条立刻听牌！',
  },
  {
    id: 'duhan',
    name: '川雀老炮',
    role: '犀利直接的高水平牌友',
    avatar: 'assets/coach/duhan.jpg',
    accent: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.15)',
    question: '那二筒呢？顺子拆一张不行吗？',
    answer:
      '别手痒乱拆五连形！23456筒自带 1/4/7筒三面改良，一旦切二筒进张直接从 19 张腰斩到 8 张。六搭先砍边张 1条，别犹豫。',
  },
] as const

export const DEMO_RADAR = {
  labels: ['拆搭效率', '进张计算', '防守意识', '牌型判断', '定缺策略'],
  values: [92, 88, 76, 85, 89],
  level: 'Lv.8 牌效大师',
  weekAccuracy: 87,
  weekOptimalRate: 74,
  streak: 14,
}

export const DEMO_TREND = {
  seasonLabel: '2026 Q3 赛季',
  xLabels: ['7/01', '7/12', '7/24', '8/05', '8/18', '8/30', '9/12', '9/25'],
  players: [
    { name: '清风', color: '#edc779', total: 186, values: [0, -32, 18, 64, 52, 112, 148, 186] },
    { name: '明月', color: '#56c9a0', total: 74, values: [0, 48, 22, 68, 95, 42, 60, 74] },
    { name: '听竹', color: '#78b8ef', total: -82, values: [0, 56, 12, -38, -64, -22, -55, -82] },
    { name: '问茶', color: '#ba9af4', total: -178, values: [0, -72, -52, -94, -83, -132, -153, -178] },
  ],
}

export const DEMO_BADGES = [
  { id: 'first_blood', name: '首战告捷', desc: '生涯首战即获一位', rarity: 'gold', rarityLabel: '黄金' },
  { id: 'century', name: '单场破百', desc: '单场得分 +100 以上', rarity: 'gold', rarityLabel: '黄金' },
  { id: 'win_streak_3', name: '连中三元', desc: '连续 3 场一位', rarity: 'silver', rarityLabel: '白银' },
  { id: 'sharp_shooter', name: '常胜将军', desc: '正分率突破 60%', rarity: 'silver', rarityLabel: '白银' },
  { id: 'stable_rock', name: '稳如泰山', desc: '标准差 ≤ 30 稳健发挥', rarity: 'silver', rarityLabel: '白银' },
  { id: 'win_streak_5', name: '五连绝世', desc: '连续 5 场一位 · 传说级统治力', rarity: 'legend', rarityLabel: '传奇' },
] as const

export const DEMO_MYSTIC = {
  nemesis: '明月',
  opponents: [
    { index: '01', name: '明月', rate: 62, games: 21, ahead: 13, behind: 8, gap: '+18.4', tag: '头号冤家', hot: true },
    { index: '02', name: '听竹', rate: 43, games: 21, ahead: 9, behind: 12, gap: '-11.2', tag: '势均力敌', hot: false },
    { index: '03', name: '问茶', rate: 33, games: 21, ahead: 7, behind: 14, gap: '-24.6', tag: '手下败将', hot: false },
  ],
  luckyPlace: { name: '松风茶社', avg: '+34.8', winRate: '75%', games: 8 },
  unluckyPlace: { name: '锦里牌坊', avg: '-28.5', winRate: '29%', games: 7 },
}

export const DEMO_VENUE = {
  targetDate: '2026-11-28 · 周六',
  candidates: [
    { no: '01', name: '松风茶社' },
    { no: '02', name: '锦里牌坊' },
    { no: '03', name: '竹韵麻将馆' },
    { no: '04', name: '锦官雅舍' },
    { no: '05', name: '青羊茶坊' },
  ],
  winnerIndex: 2, // 竹韵麻将馆
}

export const SUBTITLE_CUES: { from: number; to: number; tag: string; text: string }[] = [
  { from: 25, to: 325, tag: 'MAHJONG COACH', text: '四川麻将拆搭训练 · 四人牌桌全生态微信小程序' },
  { from: 350, to: 615, tag: '01 · 拆搭算法', text: '内置向听与进张算法，毫秒级拆解 14 张手牌每一处得失' },
  { from: 615, to: 865, tag: '01 · 拆搭算法', text: '8 大进阶章节 × 真实牌例，练出条件反射般的牌效直觉' },
  { from: 890, to: 1150, tag: '02 · AI 教练', text: '双人设 AI 教练实时陪练：温和「青竹教练」与犀利「川雀老炮」随心切换' },
  { from: 1150, to: 1390, tag: '02 · 成长雷达', text: '五维能力雷达量化短板，联动猜牌训练、错题本与收藏夹' },
  { from: 1415, to: 1720, tag: '03 · 牌桌风云', text: '固定四人身份认领与云端同步，按赛季回看累计积分走势' },
  { from: 1720, to: 1975, tag: '03 · 生涯荣誉', text: '14 枚青铜至传奇生涯徽章逐场回放核验，见证每一次高光时刻' },
  { from: 2000, to: 2305, tag: '04 · 牌桌玄学', text: '独创牌桌命簿：自动统计头号冤家压制率与福地雷区场均得分' },
  { from: 2305, to: 2610, tag: '05 · 棋牌室抽签', text: '提前 30 天公平定签，云端真随机防作弊，落章揭晓下一场去处' },
  { from: 2635, to: 3020, tag: '全栈双端', text: 'Taro 4 · React 18 · ECharts 5 · 微信云开发 — 练牌效，更懂牌局' },
]
