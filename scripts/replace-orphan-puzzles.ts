/**
 * 替换主库「一眼打孤张」题为成都风格（结构冲突 / 等价切法 / 误切退向听）。
 * Run: npx tsx scripts/replace-orphan-puzzles.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { discardUkeire } from '../src/core/shanten'
import { countTiles, type Tile } from '../src/core/tiles'

type Meld = { type: 'peng' | 'gang'; tiles: Tile[] }
type Draft = {
  id: string
  title: string
  difficulty: 3 | 4 | 5
  hand: Tile[]
  melds?: Meld[]
  tip: string
  theme: string
}

const REPLACE_IDS = new Set([
  'p04',
  'p05',
  'p06',
  'p14',
  'p16',
  'p19',
  'p21',
  'p23',
  'p27',
  'p31',
  'p32',
  'p35',
  'p36',
  'p38',
  'p39',
  'p48',
])

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

  // 禁止「一眼打孤幺九」
  const allEdge = recommended.every((t) => t[0] === '1' || t[0] === '9')
  const orphanCut = recommended.length === 1 && allEdge && (gap >= 4 || sameSh.length <= 4)

  // 成都风格：优先等价最优组，或最优在中张/重复张/对子取舍
  const multiBest = recommended.length >= 2
  const midBest = recommended.some((t) => t[0] !== '1' && t[0] !== '9')
  // 单一切听且候选极少才算送分；等价双切（如 cd03）不算
  const obvious = bestSh === 0 && sameSh.length <= 2 && !multiBest
  const tooEasyTenpai = bestSh === 0 && sameSh.length > 6

  // 成都风格：等价最优组且误切会退向听，也算合格（gap 可为 99）
  const equivTenpai = bestSh === 0 && multiBest && worseExists && sameSh.length >= 2 && sameSh.length <= 6
  const ok =
    !orphanCut &&
    !obvious &&
    !tooEasyTenpai &&
    worseExists &&
    (multiBest || midBest) &&
    (equivTenpai ||
      (gap >= 3 && gap !== 99) ||
      (gap === 99 && recommended.length >= 2 && bestSh >= 1) ||
      (bestSh === 0 && sameSh.length >= 3 && sameSh.length <= 6 && gap >= 3))

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

function buildAnalysis(d: Draft, recommended: Tile[], discussable: Tile[], bestSh: number, bestTot: number, ranked: Ranked[]) {
  const rec = fmtList(recommended)
  const shLabel = bestSh === 0 ? '已经 0 向听' : `为 ${bestSh} 向听`
  const summary = `这手牌${shLabel}。切 ${rec} 后进张 ${bestTot} 张，是当前最高效率。`
  const lines: string[] = [`推荐切法 ${rec}：向听 ${bestSh}，理论进张 ${bestTot} 张。`]
  if (discussable.length) {
    lines.push(
      `可讨论的次优：${discussable.map((t) => `${tileCn(t)}（${ranked.find((r) => r.tile === t)!.total} 张）`).join('、')}，同向听但进张略少。`
    )
  }
  const traps = ranked.filter((r) => !recommended.includes(r.tile) && !discussable.includes(r.tile)).slice(0, 3)
  if (traps.length) {
    lines.push(
      `常见误切对比：${traps.map((t) => `${tileCn(t.tile)}（向听 ${t.shanten} / 进张 ${t.total}）`).join('；')}。`
    )
  }
  lines.push(d.theme)
  return { summary, lines, tip: d.tip }
}

/** 16 道替换：结构冲突 / 多对取舍 / 长连冗余 / 等价切法 */
const replacements: Draft[] = [
  // p04 ch1
  {
    id: 'p04',
    title: '两门冗余怎么拆',
    difficulty: 4,
    hand: ['1m', '1m', '2m', '5m', '6m', '8m', '9m', '1s', '2s', '2s', '3s', '5s', '6s', '9s'],
    tip: '先保证向听不退，再在等价切法里取舍。',
    theme: '两门都有弱连接，需要拆掉一组相对较弱的重复或边张。',
  },
  // p05 — 长连旁重复张取舍（中张）
  {
    id: 'p05',
    title: '连续形里的多余张',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '6m', '7m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '1 向听阶段，几张进张的差距往往就是快一巡还是慢一巡。',
    theme: '长连旁的重复张看起来像将牌，实际可能拖后腿。',
  },
  // p06
  {
    id: 'p06',
    title: '双门长连听牌整理',
    difficulty: 4,
    hand: ['1s', '2s', '3s', '4s', '5s', '5s', '6s', '1p', '2p', '2p', '3p', '4p', '5p', '6p'],
    tip: '接近听牌时，先验证切牌后是否仍听牌，再比较听口。',
    theme: '双门长连必然有一张多余，机械切边张可能退听。',
  },
  // p14 ch3
  {
    id: 'p14',
    title: '多对局面留哪将',
    difficulty: 4,
    hand: ['1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '6s', '7s', '6p', '6p', '9p', '9p'],
    tip: '手牌里对子偏多时，先想清楚最终只需留哪一对做将。',
    theme: '条子长连很强，筒子双对最终通常只留一组将牌。',
  },
  // p16
  {
    id: 'p16',
    title: '边张搭子两端',
    difficulty: 5,
    hand: ['2m', '2m', '2m', '5m', '6m', '8m', '9m', '1p', '2p', '3p', '4p', '6p', '9p', '9p'],
    tip: '边张搭子的两端常常牌效接近，先确认是否属于等价最优组。',
    theme: '万子 89 边张搭子两端牌效相同，不要只拆一边凭感觉。',
  },
  // p19 ch4 单碰 — 两端浮牌等价
  {
    id: 'p19',
    title: '碰后两端浮牌',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '8m', '2p', '2p', '4p', '5p', '8p'],
    melds: [{ type: 'peng', tiles: ['3p', '3p', '3p'] }],
    tip: '副露后两侧浮牌看起来差不多时，用进张做裁决。',
    theme: '碰后 8 万与 8 筒牌效相同，属于等价最优组。',
  },
  // p21
  {
    id: 'p21',
    title: '副露后的搭子冲突',
    difficulty: 4,
    hand: ['2s', '3s', '4s', '5s', '6s', '8s', '9s', '2p', '3p', '4p', '7p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '同样向听时，优先进张更宽的路线。',
    theme: '碰后仍有多组搭子互抢，要算清保哪一组。',
  },
  // p23
  {
    id: 'p23',
    title: '单碰长连弹性',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '5m', '6m', '2p', '3p', '4p', '5p'],
    melds: [{ type: 'peng', tiles: ['8p', '8p', '8p'] }],
    tip: '长连的价值在于弹性；比较的是拆完之后还剩多少弹性。',
    theme: '万筒双门长连，冗余张位置决定听口质量。',
  },
  // p27 ch5
  {
    id: 'p27',
    title: '将牌位置精算',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '8m', '3p', '4p', '5p', '6p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '接近听牌时，将牌放在哪一侧会改变进张面。',
    theme: '88 万是否做将，要和筒子两面一起比较。',
  },
  // p31 ch6 — 高压 1 向听
  {
    id: 'p31',
    title: '长连可拆点在哪',
    difficulty: 5,
    hand: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '2p', '3p', '4p', '5p', '6p', '8p'],
    tip: '肉眼对称的两处拆点，进张往往并不对称。',
    theme: '双门长连的可拆点需要逐个比较进张。',
  },
  // p32
  {
    id: 'p32',
    title: '重复张是累赘还是将',
    difficulty: 5,
    hand: ['1p', '2p', '2p', '3p', '4p', '4p', '5m', '6m', '7m', '7m', '7m', '8m', '8m', '8m'],
    tip: '刚摸到的重复张不一定该留；先看它是否改善听口。',
    theme: '摸入重复张后，要确认它是有效对子还是破坏听口的累赘。',
  },
  // p35
  {
    id: 'p35',
    title: '刻旁连形怎么收',
    difficulty: 5,
    hand: ['6m', '7m', '7m', '8m', '9m', '9m', '9m', '1s', '2s', '3s', '4s', '5s', '6s', '7s'],
    tip: '同样能听牌时，优先选择听口更宽的切法。',
    theme: '刻子旁还有嵌张与长连，收官要比较听口宽度。',
  },
  // p36 — 听牌多切点等价
  {
    id: 'p36',
    title: '高压门清等价组',
    difficulty: 5,
    hand: ['2m', '2m', '2m', '3m', '4m', '5m', '6m', '2p', '3p', '4p', '5p', '6p', '7p', '8p'],
    tip: '多组切法同进张时，先确认它们是否真的等价。',
    theme: '刻子与长连并存时，常有多张等价最优切。',
  },
  // p38 ch7 双碰
  {
    id: 'p38',
    title: '双碰后的两面做将',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'],
    melds: [
      { type: 'peng', tiles: ['1p', '1p', '1p'] },
      { type: 'peng', tiles: ['3p', '3p', '3p'] },
    ],
    tip: '两组副露后，比较的是听口宽度而不是牌面好看。',
    theme: '双碰残局长连里，切点不同听口质量差很多。',
  },
  // p39 — 双碰后定将
  {
    id: 'p39',
    title: '双碰后的定将位置',
    difficulty: 5,
    hand: ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '2p'],
    melds: [
      { type: 'peng', tiles: ['1s', '1s', '1s'] },
      { type: 'peng', tiles: ['9p', '9p', '9p'] },
    ],
    tip: '双碰后只剩一门长连加一张将候选，先确认听口宽度。',
    theme: '残局长连里切点不同，听口质量差很多。',
  },
  // p48 ch8
  {
    id: 'p48',
    title: '综合结构冲突收官',
    difficulty: 5,
    hand: ['1m', '2m', '2m', '3m', '3m', '4m', '4m', '5m', '6m', '2p', '3p', '4p', '5p', '7p'],
    tip: '综合局面先排除退向听的切法，再在同向听里比进张。',
    theme: '门清高压收官常有多组搭子互抢，先算清再定切。',
  },
]

function main() {
  const fails: string[] = []
  const built = new Map<string, any>()

  for (const d of replacements) {
    const a = analyze(d)
    if (!a.ok) {
      fails.push(`${d.id} ${a.err}`)
      console.log('FAIL', d.id, a.err)
      if ('ranked' in a) console.log('  top', a.ranked.slice(0, 8))
      continue
    }
    const analysis = buildAnalysis(d, a.recommended, a.discussable, a.bestSh, a.bestTot, a.ranked)
    built.set(d.id, {
      _id: d.id,
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
    })
    console.log(
      'OK',
      d.id,
      d.title,
      `s${a.bestSh}/u${a.bestTot}`,
      'rec=' + a.recommended.join(','),
      'gap' + a.gap,
      a.discussable.length ? 'disc=' + a.discussable.join(',') : ''
    )
  }

  if (fails.length) {
    console.log('\nFAILED', fails.length)
    process.exit(1)
  }

  const exportPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-export.json')
  const dataPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-data.js')
  const lines = readFileSync(exportPath, 'utf8').trim().split('\n')
  const puzzles = lines.map((l) => JSON.parse(l))

  for (let i = 0; i < puzzles.length; i++) {
    const id = puzzles[i]._id
    if (built.has(id)) {
      const n = built.get(id)
      n.order = puzzles[i].order
      puzzles[i] = n
    }
  }

  // 再扫一遍：主库不应再有 orphanCut
  let orphanLeft = 0
  for (const p of puzzles) {
    const melds = p.melds || []
    const r = discardUkeire(p.hand, undefined, melds.length)
    const ranked = Object.entries(r)
      .map(([tile, v]) => ({ tile, shanten: (v as any).shanten, total: (v as any).total }))
      .sort((a: any, b: any) => a.shanten - b.shanten || b.total - a.total)
    const bestSh = ranked[0].shanten
    const bestTot = ranked[0].total
    const rec = ranked.filter((x: any) => x.shanten === bestSh && x.total === bestTot)
    const same = ranked.filter((x: any) => x.shanten === bestSh)
    const next = same.find((x: any) => x.total < bestTot)
    const gap = next ? bestTot - next.total : 99
    const allEdge = rec.every((x: any) => x.tile[0] === '1' || x.tile[0] === '9')
    if (rec.length === 1 && allEdge && (gap >= 4 || same.length <= 4)) {
      orphanLeft++
      console.log('STILL ORPHAN', p._id, p.title, rec[0].tile, 'gap' + gap)
    }
  }

  writeFileSync(exportPath, puzzles.map((p) => JSON.stringify(p)).join('\n') + '\n')
  const dataArr = puzzles.map(({ _id, order, ...rest }) => ({ id: _id, ...rest, order }))
  writeFileSync(
    dataPath,
    `// 自动生成：主库拆搭题 p01–p48（定缺两门）\n// 导入完成后可按需删除 importPuzzles 云函数\nmodule.exports = ${JSON.stringify(dataArr)}\n`
  )

  console.log('\nreplaced', built.size, 'orphanLeft', orphanLeft)
}

main()
