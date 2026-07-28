/**
 * 主库重构：置顶 10 手精选题 + 扩展 20 手同风格 + 筛掉简单题并重写解析
 * （川麻口诀鉴别 + 五搭原理）
 * Run: npx tsx scripts/proverb-redesign.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { discardUkeire } from '../src/core/shanten'
import { countTiles, type Tile } from '../src/core/tiles'

type Meld = { type: 'peng' | 'gang'; tiles: Tile[] }
type ProverbKey =
  | 'pairs'
  | 'abb'
  | 'gold37'
  | 'belly'
  | 'chicken'
  | 'ryanmen'
  | 'invisible'
  | 'five'

type Draft = {
  id: string
  title: string
  difficulty: 3 | 4 | 5
  hand: Tile[]
  melds?: Meld[]
  tip: string
  /** 结构主题（一句） */
  theme: string
  /** 口诀/五搭标签，用于生成解析 */
  proverbs: ProverbKey[]
  /** 五搭视角的一句话（可选覆盖） */
  fiveBlock?: string
}

function suitsOf(tiles: Tile[]) {
  return new Set(tiles.map((t) => t[1]))
}
function allTiles(hand: Tile[], melds: Meld[] = []) {
  return [...hand, ...melds.flatMap((m) => m.tiles)]
}
function validateShape(d: Draft): string | null {
  const melds = d.melds ?? []
  const expected = 14 - melds.length * 3
  if (d.hand.length !== expected) return `hand len ${d.hand.length} want ${expected}`
  const suits = suitsOf(allTiles(d.hand, melds))
  if (suits.size > 2) return `suits=${[...suits].join('')}`
  const c = countTiles(allTiles(d.hand, melds))
  for (const [t, n] of Object.entries(c)) if ((n as number) > 4) return `${t}=${n}`
  for (const m of melds) {
    if (m.tiles.length !== 3 || m.tiles.some((t) => t !== m.tiles[0])) return 'bad meld'
    if (![...suits].includes(m.tiles[0][1])) return 'meld suit'
  }
  return null
}

type Ranked = { tile: Tile; shanten: number; total: number }

function analyze(d: Draft) {
  const melds = d.melds ?? []
  const shapeErr = validateShape(d)
  if (shapeErr) return { ok: false as const, err: shapeErr }

  const r = discardUkeire(d.hand, undefined, melds.length)
  const ranked: Ranked[] = Object.entries(r)
    .map(([tile, v]) => ({ tile: tile as Tile, shanten: v.shanten, total: v.total }))
    .sort((a, b) => a.shanten - b.shanten || b.total - a.total)

  const bestSh = ranked[0].shanten
  const bestTot = ranked[0].total
  const recommended = ranked.filter((x) => x.shanten === bestSh && x.total === bestTot).map((x) => x.tile)
  const discussable = ranked
    .filter((x) => x.shanten === bestSh && x.total < bestTot && x.total >= bestTot - 3)
    .map((x) => x.tile)
  const sameSh = ranked.filter((x) => x.shanten === bestSh)
  const nextSame = sameSh.find((x) => x.total < bestTot)
  const gap = nextSame ? bestTot - nextSame.total : 99
  const worseExists = ranked.some((x) => x.shanten > bestSh)

  const allEdge = recommended.every((t) => t[0] === '1' || t[0] === '9')
  const orphanCut = recommended.length === 1 && allEdge && (gap >= 4 || sameSh.length <= 4)
  const multiBest = recommended.length >= 2
  const midBest = recommended.some((t) => t[0] !== '1' && t[0] !== '9')
  const obvious = bestSh === 0 && sameSh.length <= 2 && !multiBest
  const tooEasyTenpai = bestSh === 0 && sameSh.length > 6

  // 本批风格：等价最优 / 中张取舍 / 误切退向听；允许小 gap（只要有结构冲突）
  const structural =
    (multiBest && worseExists) ||
    (midBest && worseExists && (gap >= 2 || gap === 99)) ||
    (bestSh === 0 && multiBest && sameSh.length >= 3 && sameSh.length <= 6)

  const ok = !orphanCut && !obvious && !tooEasyTenpai && worseExists && (multiBest || midBest) && structural

  if (!ok) {
    return {
      ok: false as const,
      err: `weak s${bestSh}/u${bestTot} gap${gap} rec=${recommended} orphan=${orphanCut} multi=${multiBest} mid=${midBest}`,
      ranked,
      recommended,
      discussable,
    }
  }
  return { ok: true as const, ranked, recommended, discussable, bestSh, bestTot, gap }
}

function tileCn(t: Tile) {
  return '零一二三四五六七八九'[Number(t[0])] + (t[1] === 'm' ? '万' : t[1] === 'p' ? '筒' : '条')
}
function fmtList(tiles: Tile[]) {
  return tiles.map(tileCn).join('、')
}
function rewards(diff: number) {
  if (diff <= 3) return { xp: 14, score: 7 }
  if (diff === 4) return { xp: 18, score: 9 }
  return { xp: 22, score: 11 }
}

const PROVERB_LINES: Record<ProverbKey, string> = {
  pairs:
    '口诀「一对先定将，两对先拆搭，三对拆对、四对必碰牌、五对做七对」：一对时定将没错；两对若都是裸对，拆搭往往不进反退；三对关键不在「拆哪对」，而在别让手牌长期堆两个以上裸对——那是低效结构。',
  abb: '「一对定将」若遇 abb（如 122），出掉 a 往往提速前进；但别把这当成无脑口诀，仍要用进张验证。',
  gold37:
    '口诀「金三银七臭二八」别死记：3/7/2/8 若只是单牌，比的是自身凑搭牌效——28 不如 37，37 不如 46；「不打边三饼」也只在没有更低价牌时才成立，37 打出有时还能探 8、9。',
  belly:
    '「有将打边肚、无将打大肚」并不严谨：打不打边肚取决于有没有更低价牌，不取决于有没有将。边肚可两边吊将也可成刻；大肚也可看成两个两面搭，别被口诀绑死。',
  chicken: '「鸡不单飞」地方味重，川麻训练里优先看牌效与风险，别把口诀当铁律。',
  ryanmen:
    '「宁听两边、不听夹张」要分阶段：牌效达标时边张 9 常早早打掉；但加 8 夹 2 一类，很多时候不比 36、47 差，听口质量要精确算，不能凭感觉厌边张。',
  invisible:
    '「一路不见必有鬼，整门不见勇敢冲」：中后期整门生张，风险未必比想象大；冲出去常把牌推向大家不要的形，便于后期胡与计算——勇敢冲往往是对的。',
  five:
    '五搭原理：标准胡是 4 面子 + 1 将，一共五搭。搭子多于 5 就拆掉丢张最少的一搭；少于 5 就打掉凑搭能力最差的孤张。向听与进张，本质是在优化这五搭。',
}

function defaultFiveBlock(bestSh: number, recommended: Tile[], ranked: Ranked[]): string {
  const traps = ranked.filter((r) => r.shanten > bestSh)
  if (bestSh === 0) {
    return `五搭视角：四面子将牌已齐，本题是在「听口最宽」的切点上整理多余张；切 ${fmtList(recommended)} 后仍维持五搭听牌形。`
  }
  if (traps.length) {
    return `五搭视角：当前约差 ${bestSh + 1} 步凑齐五搭。优先切法不拆有效搭、不制造多余裸对；误切常会让搭子数倒退或进张面收窄。`
  }
  return `五搭视角：先数清完整面子、两面/嵌张/边张搭子与将候选，再决定拆哪一搭损失最小。`
}

function buildAnalysis(
  d: Draft,
  recommended: Tile[],
  discussable: Tile[],
  bestSh: number,
  bestTot: number,
  ranked: Ranked[]
) {
  const rec = fmtList(recommended)
  const shLabel = bestSh === 0 ? '已经 0 向听' : `为 ${bestSh} 向听`
  const summary = `这手牌${shLabel}。切 ${rec} 后进张 ${bestTot} 张，是当前最高效率。口诀只能作线索，最终仍以向听与进张为准。`

  const lines: string[] = []
  lines.push(d.fiveBlock || defaultFiveBlock(bestSh, recommended, ranked))
  lines.push(`推荐切法 ${rec}：向听 ${bestSh}，理论进张 ${bestTot} 张。${d.theme}`)

  if (discussable.length) {
    lines.push(
      `可讨论的次优：${discussable
        .map((t) => `${tileCn(t)}（${ranked.find((r) => r.tile === t)!.total} 张）`)
        .join('、')}，同向听但进张略少——口诀常会把你推向这类「看起来舒服」的次优。`
    )
  }

  const traps = ranked.filter((r) => !recommended.includes(r.tile) && !discussable.includes(r.tile)).slice(0, 3)
  if (traps.length) {
    lines.push(
      `常见误切对比：${traps.map((t) => `${tileCn(t.tile)}（向听 ${t.shanten} / 进张 ${t.total}）`).join('；')}。`
    )
  }

  // 口诀鉴别（去重保留顺序）
  const seen = new Set<ProverbKey>()
  for (const key of [...d.proverbs, 'five' as ProverbKey]) {
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(PROVERB_LINES[key])
  }

  lines.push('口诀上口，却大多分情况：时机不对，错切会直接降低牌效。')

  return { summary, lines, tip: d.tip }
}

/** ========== 用户提供的 10 手（置顶） ========== */
const SEEDS: Omit<Draft, 'id'>[] = [
  {
    title: '双门七对怎么拆',
    difficulty: 4,
    hand: ['1s', '1s', '1s', '2s', '3s', '7s', '7s', '8s', '2m', '2m', '2m', '6m', '7m', '7m'],
    tip: '两门都有 77 时，先用进张确认拆哪边，不要机械「留对子」。',
    theme: '条子 11123+778 与万子 222+677，两侧七对牌效相同，拆一处七即可提速。',
    proverbs: ['pairs', 'abb', 'five'],
    fiveBlock:
      '五搭视角：已有刻子与两面/边靠结构，多余的是两侧重复的七对。拆掉一张七，是在减冗余搭、把五搭推进，而不是「破坏对子」。',
  },
  {
    title: '长连旁的筒子取舍',
    difficulty: 4,
    hand: ['2m', '3m', '5m', '5m', '5m', '6m', '6m', '7m', '3p', '3p', '5p', '6p', '7p', '8p'],
    tip: '连续形两侧看起来都能拆时，逐张比进张，差一张也算差。',
    theme: '万子 23+555+667 与筒子 33+5678，切 5 筒或 8 筒等价最优。',
    proverbs: ['gold37', 'five', 'belly'],
    fiveBlock:
      '五搭视角：完整刻、两面与对子已经偏多，属于「搭多于五」要拆弱搭。5 筒与 8 筒处在连续形边缘，拆掉后整体进张面最大。',
  },
  {
    title: '多对里的五万九万',
    difficulty: 4,
    hand: ['1s', '1s', '3s', '5s', '5s', '9s', '9s', '9s', '3m', '4m', '5m', '5m', '7m', '9m'],
    tip: '多对局面先想最终留哪一对做将，其余按进张拆。',
    theme: '条子多对 + 万子 34557+9，切 5 万或 9 万同效；误切常退向听。',
    proverbs: ['pairs', 'five', 'gold37'],
    fiveBlock:
      '五搭视角：对子偏多时最终只需一将。切 5 万或 9 万是在去掉低效冗余，避免手牌堆两个以上裸对。',
  },
  {
    title: '两端浮牌等价',
    difficulty: 4,
    hand: ['2m', '4m', '5m', '5m', '5m', '6m', '8m', '1s', '2s', '4s', '5s', '6s', '6s', '7s'],
    tip: '两端浮牌牌效相同时，结合安全性与已见牌二选一即可。',
    theme: '万子 2 与 8 都不参与高效五搭，切任一都能定 1 向听最高效。',
    proverbs: ['gold37', 'five', 'invisible'],
    fiveBlock:
      '五搭视角：条子侧搭子质量高，万子 45556 已成核，2 万与 8 万是凑搭能力最差的两端浮牌，应优先离开。',
  },
  {
    title: '看似中张的弱牌',
    difficulty: 4,
    hand: ['2m', '3m', '3m', '4m', '5m', '7m', '8m', '1s', '1s', '3s', '4s', '6s', '7s', '8s'],
    tip: '中张不自动等于高价；要看它是否真的服务五搭。',
    theme: '万条纠缠时，8 万是当前进张最高的切点；凭感觉打 2 万会少几张。',
    proverbs: ['gold37', 'five', 'ryanmen'],
    fiveBlock:
      '五搭视角：两门都有两面与对子候选，8 万参与的搭最弱。打掉它不伤核心五搭，进张面最宽。',
  },
  {
    title: '长连里的重复二万',
    difficulty: 4,
    hand: ['1m', '2m', '2m', '3m', '4m', '4m', '4m', '7m', '1p', '1p', '5p', '6p', '7p', '9p'],
    tip: '长连旁的重复张，先确认是将还是累赘。',
    theme: '12234447 万里，切多余的 2 万进张最大；9 筒接近但略逊。',
    proverbs: ['abb', 'five', 'pairs'],
    fiveBlock:
      '五搭视角：1223 可看成面子+多余张。出掉多余 2 万类似 abb 提速：搭数不减、进张上升。',
  },
  {
    title: '双对浮牌怎么留',
    difficulty: 4,
    hand: ['2m', '2m', '4m', '6m', '8m', '8m', '2p', '3p', '4p', '5p', '6p', '7p', '9p', '9p'],
    tip: '两对都是裸对时，拆搭往往不进；先算哪对该留作将。',
    theme: '万子 22+88 与筒子长连+99，切 2 万或 8 万等价；误切会退向听。',
    proverbs: ['pairs', 'five', 'belly'],
    fiveBlock:
      '五搭视角：筒子长连已提供多搭，万子两对只需留一将。切掉一对里的一张，是「两对局面定将」，不是乱拆搭。',
  },
  {
    title: '四门浮张同效',
    difficulty: 5,
    hand: ['1m', '1m', '3m', '4m', '5m', '7m', '9m', '1p', '2p', '3p', '3p', '4p', '7p', '9p'],
    tip: '多张同进张时，先确认是否真等价，再谈安全。',
    theme: '7/9 万与 7/9 筒四种切法进张完全相同，都是最高效。',
    proverbs: ['gold37', 'five', 'ryanmen'],
    fiveBlock:
      '五搭视角：两门中段已有面子/两面骨架，边侧 79 是低效浮张。四张同效说明它们对五搭贡献等价，可按安全选择。',
  },
  {
    title: '两对二谁该走',
    difficulty: 4,
    hand: ['2m', '2m', '4m', '5m', '6m', '7m', '2p', '2p', '4p', '8p', '8p', '9p', '9p', '9p'],
    tip: '两门都有 22 时，拆掉一对定将，保留更强的那门。',
    theme: '万筒双 22，切任一 2 都能维持最高效 1 向听。',
    proverbs: ['pairs', 'five', 'abb'],
    fiveBlock:
      '五搭视角：已有刻、两面与多对，属于搭偏多。拆掉一对 2，是把多余将对清掉，推进标准五搭。',
  },
  {
    title: '长连听牌三切点',
    difficulty: 5,
    hand: ['2p', '3p', '4p', '5p', '6p', '7p', '8p', '4m', '4m', '4m', '5m', '6m', '6m', '6m'],
    tip: '听牌整理先验证仍听，再比听口宽度。',
    theme: '筒子长连 + 万子 4445666，切 2/5/8 筒同效定听；切 5 万听口更窄。',
    proverbs: ['ryanmen', 'five', 'belly'],
    fiveBlock:
      '五搭视角：面子与将已齐，本题是听牌收官。2、5、8 筒都是长连里的「多余张」，切后五搭听口同宽。',
  },
]

/** ========== 扩展 20 手（同风格） ========== */
const EXPANSIONS: Omit<Draft, 'id'>[] = [
  {
    title: '三对堆里定一将',
    difficulty: 4,
    hand: ['2m', '2m', '3m', '3m', '5m', '6m', '7m', '2p', '2p', '4p', '5p', '6p', '8p', '9p'],
    tip: '三对不是「随机拆一对」，而是别让裸对长期超过一个。',
    theme: '万筒多对 + 两面，切点在弱对或边张搭，误切易退向听。',
    proverbs: ['pairs', 'five'],
  },
  {
    title: '边肚两边都能切',
    difficulty: 4,
    hand: ['1m', '1m', '1m', '2m', '3m', '5m', '6m', '2p', '3p', '4p', '5p', '7p', '8p', '9p'],
    tip: '边肚去留看有没有更低价牌，不看「有没有将」。',
    theme: '11123 边肚与筒子结构并存，最优常在边肚端或弱浮张。',
    proverbs: ['belly', 'five', 'abb'],
  },
  {
    title: '金三银七别硬套',
    difficulty: 4,
    hand: ['3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '3p', '4p', '5p', '7p', '8p', '9p'],
    tip: '单牌比的是凑搭能力：28 不如 37，最终仍以进张为准。',
    theme: '长连里 3/7/2/8 的去留，要算进张而不是背口诀。',
    proverbs: ['gold37', 'five'],
  },
  {
    title: '夹张不一定差',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '4m', '5m', '6m', '8m', '1p', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '听口形态要算张数；夹张有时不比两面差。',
    theme: '两门连接紧，最优切点常在看似「好牌」的中段冗余。',
    proverbs: ['ryanmen', 'five'],
  },
  {
    title: '两对裸对别乱拆搭',
    difficulty: 4,
    hand: ['3m', '3m', '5m', '6m', '7m', '8m', '9m', '1p', '1p', '3p', '4p', '5p', '6p', '8p'],
    tip: '两对都是裸对时，拆搭往往最多持平，多数情况倒退。',
    theme: '33 万与 11 筒两对局面，切 1 筒或 8 筒等价最优。',
    proverbs: ['pairs', 'five'],
  },
  {
    title: '大肚还是两面',
    difficulty: 4,
    hand: ['3m', '4m', '5m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '5p', '7p', '8p', '9p'],
    tip: '大肚可看成两个两面；有没有更低价牌才是关键。',
    theme: '3455678 大肚形，切 2 筒或 5 筒等价定听。',
    proverbs: ['belly', 'five'],
  },
  {
    title: '整门生张敢不敢冲',
    difficulty: 5,
    hand: ['1s', '2s', '3s', '4s', '5s', '7s', '8s', '2m', '3m', '4m', '5m', '6m', '8m', '9m'],
    tip: '中后期整门不见时，冲生张常把牌推向对手不要的形。',
    theme: '双门长连高压，最优在弱连接处，误切边张可能退向听。',
    proverbs: ['invisible', 'five', 'ryanmen'],
  },
  {
    title: 'abb 提速怎么用',
    difficulty: 4,
    hand: ['1m', '2m', '2m', '3m', '5m', '6m', '7m', '3p', '4p', '5p', '6p', '7p', '8p', '9p'],
    tip: 'abb 出 a 常提速，但仍要用进张核实。',
    theme: '1223 万旁还有长连，出多余张后五搭更干净。',
    proverbs: ['abb', 'five'],
  },
  {
    title: '听牌切点别厌边',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '4p', '5p', '6p', '6p', '8p'],
    tip: '同样听牌比听口；边张听口不一定差。',
    theme: '双门长连听牌整理，多切点等价或接近。',
    proverbs: ['ryanmen', 'five'],
  },
  {
    title: '刻旁长连怎么收',
    difficulty: 5,
    hand: ['7m', '7m', '7m', '8m', '9m', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '8s', '9s'],
    tip: '刻旁还有长连时，先保住听牌再比听口。',
    theme: '万刻 + 条长连，冗余张位置决定听口宽度。',
    proverbs: ['five', 'ryanmen', 'belly'],
  },
  {
    title: '单碰后的两端浮',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '8m', '2p', '3p', '4p', '5p', '7p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '碰后手牌更紧，两端浮牌更要用进张裁决。',
    theme: '单碰后 8 万与 7 筒类浮牌冲突，算清再切。',
    proverbs: ['five', 'gold37'],
  },
  {
    title: '碰后多对定将',
    difficulty: 4,
    hand: ['2s', '2s', '4s', '5s', '6s', '7s', '8s', '2p', '2p', '4p', '5p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '副露后对子更金贵，最终仍只需一将。',
    theme: '碰后条子长连 + 双 22，切 2 条/2 筒/5 筒等价。',
    proverbs: ['pairs', 'five'],
  },
  {
    title: '副露后的搭子互咬',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '1p', '2p', '3p', '5p'],
    melds: [{ type: 'peng', tiles: ['4p', '4p', '4p'] }],
    tip: '副露后搭子冲突更紧，保留弹性更大的一侧。',
    theme: '碰后万长连与筒残张互抢，误切易退向听。',
    proverbs: ['five', 'invisible'],
  },
  {
    title: '双碰残局听口',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'],
    melds: [
      { type: 'peng', tiles: ['1p', '1p', '1p'] },
      { type: 'peng', tiles: ['3p', '3p', '3p'] },
    ],
    tip: '双碰后比的是听口宽度，不是牌面好看。',
    theme: '双碰长连残局，不同切点听口质量差很多。',
    proverbs: ['ryanmen', 'five'],
  },
  {
    title: '双碰后的将位',
    difficulty: 5,
    hand: ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '2p'],
    melds: [
      { type: 'peng', tiles: ['1s', '1s', '1s'] },
      { type: 'peng', tiles: ['9p', '9p', '9p'] },
    ],
    tip: '残局只剩长连加将候选，先确认仍听再定将。',
    theme: '双碰后切点不同，听口质量差一截。',
    proverbs: ['pairs', 'five', 'ryanmen'],
  },
  {
    title: '四张同牌与定听',
    difficulty: 5,
    hand: ['3s', '3s', '4s', '5s', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '8p', '8p', '8p'],
    tip: '四张相同要把「杠后补牌」和「直接定听」分开比。',
    theme: '四张 8 筒局面，多切点可同效定听。',
    proverbs: ['five', 'pairs'],
  },
  {
    title: '高压门清等价组',
    difficulty: 5,
    hand: ['2m', '2m', '2m', '3m', '4m', '5m', '6m', '2p', '3p', '4p', '5p', '6p', '7p', '8p'],
    tip: '多组切法同进张时，先确认它们是否真等价。',
    theme: '刻子与双门长连并存，常有多张等价最优切。',
    proverbs: ['five', 'belly'],
  },
  {
    title: '清一色长连冗余',
    difficulty: 5,
    hand: ['1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7s', '8s', '9s'],
    tip: '清一色优先比听口宽度，不要只看「更中张」。',
    theme: '清一色长连必有多余张，多切点可同效。',
    proverbs: ['ryanmen', 'five', 'invisible'],
  },
  {
    title: '重复张是累赘吗',
    difficulty: 5,
    hand: ['1p', '2p', '2p', '3p', '4p', '4p', '5m', '6m', '7m', '7m', '7m', '8m', '8m', '8m'],
    tip: '刚摸到的重复张不一定该留；先看是否改善听口。',
    theme: '摸入重复张后，确认是有效对子还是破坏听口的累赘。',
    proverbs: ['pairs', 'five', 'abb'],
  },
  {
    title: '综合结构冲突收官',
    difficulty: 5,
    hand: ['1m', '2m', '2m', '3m', '3m', '4m', '4m', '5m', '6m', '2p', '3p', '4p', '5p', '7p'],
    tip: '先排除退向听的切法，再在同向听里比进张。',
    theme: '门清高压常有多组搭子互抢，口诀帮不了忙，要算。',
    proverbs: ['five', 'pairs', 'gold37'],
  },
]

/** 从旧库筛「非简单」题补齐到 50；简单题丢弃 */
function isSimpleOld(p: {
  recommendedDiscards: Tile[]
  hand: Tile[]
  melds?: Meld[]
}): boolean {
  const melds = p.melds ?? []
  const r = discardUkeire(p.hand, undefined, melds.length)
  const ranked = Object.entries(r)
    .map(([tile, v]) => ({ tile: tile as Tile, shanten: v.shanten, total: v.total }))
    .sort((a, b) => a.shanten - b.shanten || b.total - a.total)
  const bestSh = ranked[0].shanten
  const bestTot = ranked[0].total
  const recommended = ranked.filter((x) => x.shanten === bestSh && x.total === bestTot).map((x) => x.tile)
  const sameSh = ranked.filter((x) => x.shanten === bestSh)
  const next = sameSh.find((x) => x.total < bestTot)
  const gap = next ? bestTot - next.total : 99
  const worseExists = ranked.some((x) => x.shanten > bestSh)
  const allEdge = recommended.every((t) => t[0] === '1' || t[0] === '9')
  const orphanCut = recommended.length === 1 && allEdge && (gap >= 4 || sameSh.length <= 4)
  const multiBest = recommended.length >= 2
  const midBest = recommended.some((t) => t[0] !== '1' && t[0] !== '9')
  const obvious = bestSh === 0 && sameSh.length <= 2 && !multiBest
  const tooEasy = bestSh === 0 && sameSh.length > 6
  if (orphanCut || obvious || tooEasy || !worseExists) return true
  if (!(multiBest || midBest)) return true
  // 一眼差距过大且单切边张，也算简单
  if (recommended.length === 1 && allEdge && gap >= 6) return true
  return false
}

function handKey(hand: Tile[], melds: Meld[] = []) {
  return [...hand].sort().join('') + '|' + melds.map((m) => m.tiles[0]).sort().join(',')
}

function inferProverbs(hand: Tile[], recommended: Tile[]): ProverbKey[] {
  const keys: ProverbKey[] = ['five']
  const counts = countTiles(hand)
  const pairCount = Object.values(counts).filter((n) => n === 2).length
  if (pairCount >= 2) keys.unshift('pairs')
  if (recommended.some((t) => t[0] === '3' || t[0] === '7' || t[0] === '2' || t[0] === '8')) {
    keys.push('gold37')
  }
  if (recommended.length >= 2) keys.push('ryanmen')
  return keys.slice(0, 3) as ProverbKey[]
}

function main() {
  const fails: string[] = []
  const built: any[] = []
  const usedKeys = new Set<string>()

  const assign = (partial: Omit<Draft, 'id'>, id: string) => {
    const d: Draft = { ...partial, id }
    const key = handKey(d.hand, d.melds)
    if (usedKeys.has(key)) {
      fails.push(`${id} duplicate hand`)
      return
    }
    const a = analyze(d)
    if (!a.ok) {
      fails.push(`${id} ${a.err}`)
      console.log('FAIL', id, d.title, a.err)
      if ('ranked' in a) console.log('  top', a.ranked!.slice(0, 8))
      return
    }
    usedKeys.add(key)
    const analysis = buildAnalysis(d, a.recommended, a.discussable, a.bestSh, a.bestTot, a.ranked)
    built.push({
      _id: id,
      mode: 'discard',
      variant: 'basic',
      title: d.title,
      difficulty: d.difficulty,
      hand: d.hand,
      melds: d.melds || [],
      recommendedDiscards: a.recommended,
      discussableDiscards: a.discussable,
      analysis,
      rewards: rewards(d.difficulty),
      order: built.length + 1,
    })
    console.log(
      'OK',
      id,
      d.title,
      `s${a.bestSh}/u${a.bestTot}`,
      'rec=' + a.recommended.join(','),
      'gap' + a.gap
    )
  }

  const nextTempId = () => `t${String(built.length + 1).padStart(2, '0')}`

  // 1) 10 seeds
  SEEDS.forEach((s) => assign(s, nextTempId()))
  // 2) 20 expansions
  EXPANSIONS.forEach((s) => assign(s, nextTempId()))
  console.log('after seeds+expansions', built.length)

  // 3) 从旧库补齐到 50，跳过简单题与重复牌型
  const exportPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-export.json')
  const old = readFileSync(exportPath, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))

  for (const p of old) {
    if (built.length >= 50) break
    if (isSimpleOld(p)) {
      console.log('DROP simple', p._id, p.title)
      continue
    }
    const key = handKey(p.hand, p.melds || [])
    if (usedKeys.has(key)) {
      console.log('DROP dup', p._id, p.title)
      continue
    }
    const id = nextTempId()
    const draft: Draft = {
      id,
      title: p.title,
      difficulty: Math.max(3, Math.min(5, p.difficulty)) as 3 | 4 | 5,
      hand: p.hand,
      melds: p.melds,
      tip: p.analysis?.tip || '先保证向听不退，再用进张裁决。',
      theme: p.analysis?.lines?.[0] || '结构取舍以进张为准。',
      proverbs: inferProverbs(p.hand, p.recommendedDiscards),
    }
    const a = analyze(draft)
    if (!a.ok) {
      console.log('DROP weak', p._id, a.err)
      continue
    }
    usedKeys.add(key)
    const analysis = buildAnalysis(draft, a.recommended, a.discussable, a.bestSh, a.bestTot, a.ranked)
    built.push({
      _id: id,
      mode: 'discard',
      variant: 'basic',
      title: draft.title,
      difficulty: draft.difficulty,
      hand: draft.hand,
      melds: draft.melds || [],
      recommendedDiscards: a.recommended,
      discussableDiscards: a.discussable,
      analysis,
      rewards: rewards(draft.difficulty),
      order: built.length + 1,
    })
    console.log('KEEP', p._id, '->', id, draft.title, `s${a.bestSh}/u${a.bestTot}`)
  }

  // 若不足 50，用额外草稿补（在脚本内再挂一批备用）
  const FILLERS: Omit<Draft, 'id'>[] = [
    {
      title: '两面与嵌张互抢',
      difficulty: 4,
      hand: ['2m', '3m', '4m', '5m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '6p', '7p', '8p'],
      tip: '多组搭子无法全留时，保留进张面更宽的一侧。',
      theme: '两门搭子互咬，最优切点在弱搭。',
      proverbs: ['five', 'gold37'],
    },
    {
      title: '中张也可能最弱',
      difficulty: 4,
      hand: ['2m', '3m', '4m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '5p', '7p', '8p'],
      tip: '中张不自动高价；看它是否服务五搭。',
      theme: '双门连续形里，6 万或 9 万可能同为最弱。',
      proverbs: ['five', 'gold37'],
    },
    {
      title: '边张搭子两端',
      difficulty: 5,
      hand: ['2m', '2m', '2m', '5m', '6m', '8m', '9m', '1p', '2p', '3p', '4p', '6p', '9p', '9p'],
      tip: '边张搭子两端常常牌效接近。',
      theme: '89 万两端等价，不要只凭感觉拆一边。',
      proverbs: ['five', 'belly'],
    },
    {
      title: '多对留哪将',
      difficulty: 4,
      hand: ['1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '6s', '7s', '6p', '6p', '9p', '9p'],
      tip: '对子偏多时，先想清楚最终留哪一对做将。',
      theme: '条子长连很强，筒子双对通常只留一将。',
      proverbs: ['pairs', 'five'],
    },
    {
      title: '单碰长连弹性',
      difficulty: 5,
      hand: ['1m', '2m', '3m', '4m', '5m', '5m', '6m', '2p', '3p', '4p', '5p'],
      melds: [{ type: 'peng', tiles: ['8p', '8p', '8p'] }],
      tip: '长连价值在弹性；比的是拆完还剩多少弹性。',
      theme: '万筒双门长连，冗余位置决定听口。',
      proverbs: ['five', 'ryanmen'],
    },
    {
      title: '将牌位置精算',
      difficulty: 5,
      hand: ['2m', '3m', '4m', '6m', '7m', '8m', '8m', '3p', '4p', '5p', '6p'],
      melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
      tip: '接近听牌时，将牌放哪一侧会改变进张面。',
      theme: '88 万是否做将，要和筒子两面一起比较。',
      proverbs: ['pairs', 'five'],
    },
    {
      title: '长连可拆点',
      difficulty: 5,
      hand: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '2p', '3p', '4p', '5p', '6p', '8p'],
      tip: '肉眼对称的拆点，进张往往并不对称。',
      theme: '双门长连可拆点需逐个比较进张。',
      proverbs: ['five', 'invisible'],
    },
    {
      title: '刻旁连形收官',
      difficulty: 5,
      hand: ['6m', '7m', '7m', '8m', '9m', '9m', '9m', '1s', '2s', '3s', '4s', '5s', '6s', '7s'],
      tip: '同样能听牌时，优先听口更宽的切法。',
      theme: '刻旁嵌张与长连，收官比听口宽度。',
      proverbs: ['five', 'ryanmen'],
    },
    {
      title: '两门冗余怎么拆',
      difficulty: 4,
      hand: ['1m', '1m', '2m', '5m', '6m', '8m', '9m', '1s', '2s', '2s', '3s', '5s', '6s', '9s'],
      tip: '先保证向听不退，再在等价切法里取舍。',
      theme: '两门都有弱连接，拆掉相对较弱的重复或边张。',
      proverbs: ['five', 'pairs'],
    },
    {
      title: '连续形多余张',
      difficulty: 4,
      hand: ['2m', '3m', '4m', '5m', '6m', '6m', '7m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
      tip: '1 向听时几张进张差距就是快一巡慢一巡。',
      theme: '长连旁重复张看起来像将，实际可能拖后腿。',
      proverbs: ['five', 'pairs', 'abb'],
    },
  ]

  for (const f of FILLERS) {
    if (built.length >= 50) break
    const id = `p${String(built.length + 1).padStart(2, '0')}`
    assign(f, id)
  }

  if (fails.length) {
    console.log('\nFAILED', fails.length)
    fails.forEach((f) => console.log(' ', f))
  }

  console.log('\nbuilt', built.length, 'unique', usedKeys.size)

  if (built.length < 48) {
    console.log('NOT ENOUGH puzzles')
    process.exit(1)
  }

  // 截到 50，重排 id/order
  const final = built.slice(0, 50).map((p, i) => {
    const id = `p${String(i + 1).padStart(2, '0')}`
    return { ...p, _id: id, order: i + 1 }
  })

  writeFileSync(exportPath, final.map((p) => JSON.stringify(p)).join('\n') + '\n')
  const dataPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-data.js')
  const dataArr = final.map(({ _id, order, ...rest }) => ({ id: _id, ...rest, order }))
  writeFileSync(
    dataPath,
    `// 自动生成：主库拆搭题 p01–p${String(final.length).padStart(2, '0')}（定缺两门，含口诀/五搭解析）\nmodule.exports = ${JSON.stringify(dataArr)}\n`
  )

  // 章节
  const chaptersPath = join(__dirname, '../src/content/chapters.ts')
  const n = final.length
  const chapterMeta = [
    { title: '对子定将与拆搭', desc: '一对定将、两对慎拆；用五搭和进张检验口诀' },
    { title: '五搭整理入门', desc: '搭多于五就拆弱搭，少于五就打低效孤张' },
    { title: '口诀真假鉴别', desc: '金三银七、边肚、夹张：分情况算，不硬套' },
    { title: '长连与冗余张', desc: '连续形里找出真正多余的那张' },
    { title: '单碰后的牌效', desc: '副露后手牌更紧，仍要比进张与五搭' },
    { title: '高压门清', desc: '1～2 向听纠缠时，口诀让位给进张' },
    { title: '双碰残局', desc: '两组副露后比较听口宽度与将位' },
    { title: '综合收官', desc: '等价最优、陷阱次优与听牌整理混练' },
  ]
  // 50 题均分到 8 章：6,6,6,6,7,7,6,6
  const sizes = [6, 6, 6, 6, 7, 7, 6, 6]
  let offset = 0
  const chapters = chapterMeta.map((meta, ci) => {
    const size = sizes[ci]
    const ids = final.slice(offset, offset + size).map((p) => p._id)
    offset += size
    return {
      id: `ch${ci + 1}`,
      title: meta.title,
      desc: meta.desc,
      puzzles: ids,
    }
  }).filter((c) => c.puzzles.length > 0)

  const chaptersTs = `export type Chapter = {
  id: string
  title: string
  desc: string
  /** 该章节包含的题目 ID */
  puzzles: string[]
}

export const CHAPTERS: Chapter[] = ${JSON.stringify(chapters, null, 2).replace(/"([^"]+)":/g, '$1:').replace(/"/g, "'")}

/** 前 N 章自由进入，之后需完成上一章 */
export const FREE_CHAPTERS = 2
`
  // JSON.stringify with quote replace is fragile; write cleaner
  const chBody = chapters
    .map((c) => {
      const ids = c.puzzles.map((id) => `'${id}'`).join(', ')
      return `  {
    id: '${c.id}',
    title: '${c.title}',
    desc: '${c.desc}',
    puzzles: [${ids}],
  }`
    })
    .join(',\n')
  writeFileSync(
    chaptersPath,
    `export type Chapter = {
  id: string
  title: string
  desc: string
  /** 该章节包含的题目 ID */
  puzzles: string[]
}

export const CHAPTERS: Chapter[] = [
${chBody},
]

/** 前 N 章自由进入，之后需完成上一章 */
export const FREE_CHAPTERS = 2
`
  )

  console.log('exported', final.length, 'chapters', chapters.length)
}

main()
