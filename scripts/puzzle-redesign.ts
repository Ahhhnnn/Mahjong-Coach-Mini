/**
 * Redesign main puzzle bank (p01–p48). Run:
 *   /path/to/tsx scripts/puzzle-redesign.ts
 */
import { discardUkeire } from '../src/core/shanten'
import { countTiles, type Tile } from '../src/core/tiles'
import { writeFileSync } from 'fs'
import { join } from 'path'

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

function suitsOf(tiles: Tile[]): Set<string> {
  return new Set(tiles.map((t) => t[1]))
}

function allTiles(hand: Tile[], melds: Meld[] = []): Tile[] {
  return [...hand, ...melds.flatMap((m) => m.tiles)]
}

function validateShape(d: Draft): string | null {
  const melds = d.melds ?? []
  const expected = 14 - melds.length * 3
  if (d.hand.length !== expected) return `hand len ${d.hand.length} want ${expected}`
  const suits = suitsOf(allTiles(d.hand, melds))
  if (suits.size > 2) return `suits=${[...suits].join('')}`
  if (suits.size < 1) return 'no suits'
  const c = countTiles(allTiles(d.hand, melds))
  for (const [t, n] of Object.entries(c)) {
    if ((n as number) > 4) return `${t} count ${n}`
  }
  for (const m of melds) {
    if (m.tiles.length !== 3 || m.tiles.some((t) => t !== m.tiles[0])) return 'bad meld'
    if (![...suits].includes(m.tiles[0][1])) return 'meld suit outside dingque'
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
  const keepBest = sameSh.length

  // 送分：听牌后只剩 1～2 张可切；或超过 6 种切法都能听
  const obvious = bestSh === 0 && keepBest <= 2
  const tooEasyTenpai = bestSh === 0 && keepBest > 6

  const ok =
    !obvious &&
    !tooEasyTenpai &&
    worseExists &&
    ((gap >= 3 && gap !== 99) ||
      (gap === 99 && keepBest >= 2 && bestSh >= 1) ||
      (bestSh === 0 && keepBest >= 3 && keepBest <= 6 && gap >= 3))

  if (!ok) {
    return {
      ok: false as const,
      err: `weak s${bestSh}/u${bestTot} gap${gap} keep${keepBest} obvious=${obvious} easy=${tooEasyTenpai}`,
      ranked,
      recommended,
      discussable,
    }
  }

  return { ok: true as const, ranked, recommended, discussable, bestSh, bestTot, gap, keepBest }
}

function tileCn(t: Tile): string {
  const n = '零一二三四五六七八九'[Number(t[0])]
  const s = t[1] === 'm' ? '万' : t[1] === 'p' ? '筒' : '条'
  return `${n}${s}`
}

function fmtList(tiles: Tile[]): string {
  return tiles.map(tileCn).join('、')
}

function rewards(diff: number) {
  if (diff <= 3) return { xp: 14, score: 7 }
  if (diff === 4) return { xp: 18, score: 9 }
  return { xp: 22, score: 11 }
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
  const summary = `这手牌${shLabel}。切 ${rec} 后进张 ${bestTot} 张，是当前最高效率。`

  const lines: string[] = []
  lines.push(`推荐切法 ${rec}：向听 ${bestSh}，理论进张 ${bestTot} 张。`)

  if (discussable.length) {
    const dRows = discussable.map((t) => {
      const row = ranked.find((r) => r.tile === t)!
      return `${tileCn(t)}（${row.total} 张）`
    })
    lines.push(`可讨论的次优：${dRows.join('、')}，同向听但进张略少。`)
  }

  const traps = ranked
    .filter((r) => !recommended.includes(r.tile) && !discussable.includes(r.tile))
    .slice(0, 3)
  if (traps.length) {
    lines.push(
      `常见误切对比：${traps
        .map((t) => `${tileCn(t.tile)}（向听 ${t.shanten} / 进张 ${t.total}）`)
        .join('；')}。`
    )
  }
  lines.push(d.theme)

  return { summary, lines, tip: d.tip }
}

const drafts: Draft[] = [
  // ===== ch1 两门浮牌与孤张（偏 1 向听进张比较）=====
  {
    id: 'p01',
    title: '最弱边张在哪里',
    difficulty: 3,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '先标出完整顺子和两面，剩下的才是候选切牌。',
    theme: '万子与筒子主体成型后，游离边张往往进张最低。',
  },
  {
    id: 'p02',
    title: '中张也可能最弱',
    difficulty: 3,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '5p', '7p', '8p'],
    tip: '中张不等于高效；看它对多组结构的贡献。',
    theme: '看起来顺眼的中张，若接不上主体长连，仍可能是最弱牌。',
  },
  {
    id: 'p03',
    title: '双门边缘精算',
    difficulty: 3,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '1p', '2p', '3p', '5p', '6p', '8p', '9p'],
    tip: '同向听下进张差几张，往往就是快慢差一巡。',
    theme: '多个边张候选并存时，必须用进张总数裁决。',
  },
  {
    id: 'p04',
    title: '连续结构外的刺',
    difficulty: 4,
    hand: ['1s', '2s', '3s', '4s', '5s', '7s', '8s', '2p', '3p', '4p', '5p', '6p', '7p', '9p'],
    tip: '长连看起来很强，但门外孤张可能拖慢整手牌。',
    theme: '双门长连时优先处理完全接不上的孤张。',
  },
  {
    id: 'p05',
    title: '看似搭子的废牌',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '8m', '9m', '1p', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '边张搭子只有一端有用时，要和真正两面比较。',
    theme: '弱边张连接的进张，通常远低于主体两面。',
  },
  {
    id: 'p06',
    title: '保护长连删孤张',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '8m', '9m', '2p', '3p', '4p', '5p', '6p', '7p', '9p'],
    tip: '两门都有长连时，优先处理不属于任何长连的牌。',
    theme: '门外孤张与长连端张的进张差距会被算法放大。',
  },

  // ===== ch2 搭子冲突 =====
  {
    id: 'p07',
    title: '两面撞两面',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '8m', '9m', '1p', '2p', '3p', '4p', '6p', '7p', '8p'],
    tip: '多组搭子无法全留时，保留进张面更宽的一侧。',
    theme: '万子边张与筒子长连冲突时，用进张选该拆哪端。',
  },
  {
    id: 'p08',
    title: '长连两端怎么拆',
    difficulty: 4,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '长连两端都可以拆时，拆完后进张更大的那端才是答案。',
    theme: '万子与筒子双结构下的端张精算。',
  },
  {
    id: 'p09',
    title: '三组形状留两组',
    difficulty: 4,
    hand: ['1s', '2s', '3s', '4s', '5s', '6s', '2p', '3p', '4p', '6p', '7p', '8p', '8p', '9p'],
    tip: '形状过多时先数最终需要几组面子，再决定拆哪组。',
    theme: '多余边张搭子会挤占进张，必须主动放弃。',
  },
  {
    id: 'p10',
    title: '拆哪一端更赚',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '5p', '7p', '8p'],
    tip: '端张拆点不能凭感觉，要用进张验证。',
    theme: '双门长连的可拆点往往不对称。',
  },
  {
    id: 'p11',
    title: '搭子与对子抢位',
    difficulty: 4,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '3p', '5p', '6p', '8p', '9p'],
    tip: '对子可以当将，但不要为了留对子拆掉更宽的两面。',
    theme: '对子与多组筒子搭子并存时，比较拆哪张进张最大。',
  },
  {
    id: 'p12',
    title: '双门搭子互咬',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '两门形状看似对称时，进张往往会打破直觉。',
    theme: '高压 2 向听局面，先删进张贡献最低的边张组。',
  },

  // ===== ch3 对子与重复张 =====
  {
    id: 'p13',
    title: '多余对子该拆谁',
    difficulty: 4,
    hand: ['1m', '1m', '2m', '3m', '4m', '5m', '5m', '6m', '7m', '8m', '2p', '2p', '4p', '5p'],
    tip: '有效搭子已经够时，多出来的对子要主动拆掉。',
    theme: '万子双对子与连续搭子冲突，拆对子换进张。',
  },
  {
    id: 'p14',
    title: '长连旁的重复张',
    difficulty: 4,
    hand: ['1m', '2m', '3m', '4m', '6m', '7m', '8m', '1p', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '顺子旁边多出来的一张，常常不是有效对子。',
    theme: '听牌多候选时，最宽听口往往落在不起眼的孤张切法上。',
  },
  {
    id: 'p15',
    title: '听口质量比较',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '1p', '2p', '3p', '5p', '6p', '7p', '8p', '9p'],
    tip: '同样能听牌时，优先更宽、更中张的听口。',
    theme: '0 向听多候选：最宽听口需要在几张边张里精算。',
  },
  {
    id: 'p16',
    title: '游离边张终结',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '1p', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '长连主体成型后，门外孤张通常是最先该走的牌。',
    theme: '宽听与窄听并存时，切对孤张听口可差一倍。',
  },
  {
    id: 'p17',
    title: '重复张还是真将',
    difficulty: 5,
    hand: ['1s', '2s', '3s', '3s', '4s', '5s', '7s', '8s', '2p', '3p', '4p', '5p', '6p', '8p'],
    tip: '先确认重复牌是否承担将牌或搭子，再决定去留。',
    theme: '长连中的重复张可能是冗余，切掉反而进张最大。',
  },
  {
    id: 'p18',
    title: '多对密度整理',
    difficulty: 5,
    hand: ['1m', '1m', '3m', '3m', '5m', '6m', '7m', '8m', '2p', '2p', '4p', '5p', '6p', '8p'],
    tip: '对子很多时，比较标准形路线，不要机械留所有对。',
    theme: '多对局面拆错一对会直接掉向听或腰斩进张。',
  },

  // ===== ch4 单碰·进张战 =====
  {
    id: 'p19',
    title: '碰后最弱浮牌',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '2p', '3p', '4p', '5p', '9p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '副露后门牌更少，更要先删零贡献牌。',
    theme: '定缺万筒，碰后比较门牌浮牌的真实进张。',
  },
  {
    id: 'p20',
    title: '碰后别拆两面',
    difficulty: 4,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '5p', '8p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '碰牌不等于改碰碰胡；门牌两面仍优先保留。',
    theme: '碰后若门牌有清晰两面，不要为处理孤张而拆两面。',
  },
  {
    id: 'p21',
    title: '副露后的进张断层',
    difficulty: 4,
    hand: ['1s', '2s', '3s', '4s', '5s', '7s', '8s', '2p', '3p', '4p', '9p'],
    melds: [{ type: 'peng', tiles: ['8p', '8p', '8p'] }],
    tip: '同向听下几张进张的差距，副露追速时更关键。',
    theme: '条筒定缺，碰后切孤张与切边张的进张可差近十张。',
  },
  {
    id: 'p22',
    title: '碰后重复张处理',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '4m', '6m', '7m', '8m', '2p', '3p', '5p', '6p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '重复张是否有用，看它是否承担将牌或延展。',
    theme: '234 旁重复张与筒子连接并存时的取舍。',
  },
  {
    id: 'p23',
    title: '单碰高压浮牌',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '2p', '3p', '4p', '6p', '7p', '9p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '碰后仍要比较整体进张，不能只盯着有没有搭子。',
    theme: '万筒定缺，碰后找出对多组结构都帮不上忙的牌。',
  },
  {
    id: 'p24',
    title: '碰后搭子冲突',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '6p', '9p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '副露后搭子冲突更紧，先保留能形成多种完成方式的连接。',
    theme: '单碰后 2 向听高压：进张断层可达十余张。',
  },

  // ===== ch5 单碰·形变与将牌 =====
  {
    id: 'p25',
    title: '碰后浮牌精算',
    difficulty: 4,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '2p', '3p', '5p', '6p', '8p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '副露后仍先删零贡献牌，再谈将牌与两面。',
    theme: '碰后 1 向听：两张候选浮牌可能进张完全相同。',
  },
  {
    id: 'p26',
    title: '听牌形多候选',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '2p', '3p', '4p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '能听牌的切法不止一种时，比较听口张数与质量。',
    theme: '长连收官：切错端张会从宽听变成窄听。',
  },
  {
    id: 'p27',
    title: '拆顺还是拆将',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '9p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '已有将牌雏形时，先比较切边张与切中张的听口宽度。',
    theme: '碰后听牌整理：宽听边张往往藏在不起眼的位置。',
  },
  {
    id: 'p28',
    title: '边张听与中张听',
    difficulty: 5,
    hand: ['2s', '3s', '4s', '5s', '6s', '8s', '9s', '2p', '3p', '4p', '7p'],
    melds: [{ type: 'peng', tiles: ['1p', '1p', '1p'] }],
    tip: '同样向听时，优先进张更宽的路线。',
    theme: '条筒定缺碰后，边张浮牌与长连端张的进张可差六张以上。',
  },
  {
    id: 'p29',
    title: '副露后多面整理',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '5p', '8p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '长连听牌整理：假设有一张多余，验证切哪张进张最大。',
    theme: '碰后长连中找出可拆且效率最高的位置。',
  },
  {
    id: 'p30',
    title: '将牌争夺战',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '3p', '6p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '两组都能当将时，比较留下哪组后的进张与听口。',
    theme: '将牌位争夺要用进张说话，不能只看对子是否好看。',
  },

  // ===== ch6 高压门清 =====
  {
    id: 'p31',
    title: '长连可拆点',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '看见 5～6 张连牌，先假设有一张多余再验证。',
    theme: '万子长连与筒子连接冲突的高压 1 向听。',
  },
  {
    id: 'p32',
    title: '双门高压浮牌',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '9m', '2p', '3p', '4p', '4p', '6p', '9p'],
    tip: '牌越乱，越先用「是否参与任何高效搭子」筛选。',
    theme: '复杂 1 向听中找出进张断层最大的切法。',
  },
  {
    id: 'p33',
    title: '进张腰斩陷阱',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '8m', '1p', '2p', '3p', '4p', '6p', '7p', '9p'],
    tip: '先锁定最优进张集合，再在集合内用场况细分。',
    theme: '重复张与边张看似接近，进张可能差一截。',
  },
  {
    id: 'p34',
    title: '2 向听也要精算',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '向听还早时也要比较前进空间，不能只看向听数。',
    theme: '2 向听高压：最优与次优可差数张进张。',
  },
  {
    id: 'p35',
    title: '对称牌面破直觉',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '6p', '7p', '9p'],
    tip: '看起来对称的两张牌，进张往往并不对称。',
    theme: '重复张与边张的精确比较。',
  },
  {
    id: 'p36',
    title: '门外孤张终结者',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '6m', '7m', '8m', '9m', '2p', '3p', '5p', '6p', '7p', '9p'],
    tip: '两门都有长连时，优先处理不属于任何长连的牌。',
    theme: '保护双门长连，删除门外孤张。',
  },

  // ===== ch7 双碰残局（考听口质量，避免「只剩两张随便切」）=====
  {
    id: 'p37',
    title: '长连收官切哪端',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'],
    melds: [
      { type: 'peng', tiles: ['1p', '1p', '1p'] },
      { type: 'peng', tiles: ['2p', '2p', '2p'] },
    ],
    tip: '双碰后长连收官，切错端张会从宽听变成窄听。',
    theme: '定缺万筒：八张长连中比较各切点的听口宽度。',
  },
  {
    id: 'p38',
    title: '端张宽听识别',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '9m'],
    melds: [
      { type: 'peng', tiles: ['8p', '8p', '8p'] },
      { type: 'peng', tiles: ['9p', '9p', '9p'] },
    ],
    tip: '游离端张往往是最宽听口的钥匙，也是最容易被忽略的切点。',
    theme: '长连旁多一张 9 万时，切它通常听口最宽。',
  },
  {
    id: 'p39',
    title: '条子端张宽听',
    difficulty: 5,
    hand: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '9s'],
    melds: [
      { type: 'peng', tiles: ['2p', '2p', '2p'] },
      { type: 'peng', tiles: ['8p', '8p', '8p'] },
    ],
    tip: '游离端张往往是最宽听口的钥匙。',
    theme: '条筒双碰：长连旁多一张端张时，切它通常听口最宽。',
  },
  {
    id: 'p40',
    title: '条子长连收官',
    difficulty: 5,
    hand: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s'],
    melds: [
      { type: 'peng', tiles: ['3p', '3p', '3p'] },
      { type: 'peng', tiles: ['9p', '9p', '9p'] },
    ],
    tip: '清一门长连收官时，逐个验证切点听口，不要只切最边。',
    theme: '条筒定缺双碰：八张条子连续的听口精算。',
  },
  {
    id: 'p41',
    title: '筒子长连宽听',
    difficulty: 5,
    hand: ['2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p'],
    melds: [
      { type: 'peng', tiles: ['1m', '1m', '1m'] },
      { type: 'peng', tiles: ['2m', '2m', '2m'] },
    ],
    tip: '长连两端并非等价，宽听通常落在特定切点。',
    theme: '万筒定缺：筒子长连收官的听口比较。',
  },
  {
    id: 'p42',
    title: '中段可拆点',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m'],
    melds: [
      { type: 'peng', tiles: ['5p', '5p', '5p'] },
      { type: 'peng', tiles: ['9p', '9p', '9p'] },
    ],
    tip: '长连中段也可能是最优切点，关键看切完后听几张。',
    theme: '八张连续万子的中段/端张听口对比。',
  },

  // ===== ch8 综合难题 =====
  {
    id: 'p43',
    title: '终局浮牌判断',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '5p', '6p', '7p', '8p', '9p'],
    tip: '听牌前后都要比较进张，不要只留看起来中张的牌。',
    theme: '综合 1 向听：多个端张候选里用进张找出最优组。',
  },
  {
    id: 'p44',
    title: '长连弹性比较',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '5p', '6p', '8p', '9p'],
    tip: '长连的价值在于弹性；比较的是拆完之后还剩多少弹性。',
    theme: '双门长连可拆点的综合题。',
  },
  {
    id: 'p45',
    title: '多组等价最优',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '5p', '6p', '8p', '9p'],
    tip: '先识别等价最优集合，再谈风格与防守。',
    theme: '筒子多组冲突时的多张等价最优切。',
  },
  {
    id: 'p46',
    title: '单碰综合高压',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '4m', '5m', '7m', '8m', '2p', '3p', '6p', '9p'],
    melds: [{ type: 'peng', tiles: ['9p', '9p', '9p'] }],
    tip: '碰牌后先固定副露面子，再把门牌重新分组比较。',
    theme: '单碰后 2 向听：最优切与误切进张可差十余张。',
  },
  {
    id: 'p47',
    title: '陷阱次优识别',
    difficulty: 5,
    hand: ['2m', '3m', '4m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p', '5p', '7p', '9p'],
    tip: '最终判断永远回到两件事：向听有没有变差，进张有没有变少。',
    theme: '最优与「看起来也对」的次优之间拉开进张差。',
  },
  {
    id: 'p48',
    title: '综合收官抉择',
    difficulty: 5,
    hand: ['1m', '2m', '3m', '5m', '6m', '7m', '9m', '2p', '3p', '4p', '5p', '6p', '7p', '8p'],
    tip: '听牌优先，删除对长连零贡献的端张。',
    theme: '接近听牌的综合题：保护长连，处理游离端张。',
  },
]

function toExportRow(d: Draft, a: Extract<ReturnType<typeof analyze>, { ok: true }>, order: number) {
  return {
    _id: d.id,
    mode: 'discard' as const,
    variant: 'basic' as const,
    title: d.title,
    difficulty: d.difficulty,
    hand: d.hand,
    melds: d.melds ?? [],
    recommendedDiscards: a.recommended,
    discussableDiscards: a.discussable,
    analysis: buildAnalysis(d, a.recommended, a.discussable, a.bestSh, a.bestTot, a.ranked),
    rewards: rewards(d.difficulty),
    order,
  }
}

function main() {
  const results: ReturnType<typeof toExportRow>[] = []
  const failed: { id: string; err: string; top?: string }[] = []

  for (const d of drafts) {
    const a = analyze(d)
    if (!a.ok) {
      failed.push({
        id: d.id,
        err: a.err,
        top: a.ranked
          ?.slice(0, 8)
          .map((x) => `${x.tile}:s${x.shanten}/u${x.total}`)
          .join(' | '),
      })
      continue
    }
    results.push(toExportRow(d, a, Number(d.id.slice(1))))
  }

  console.log(`OK ${results.length} / ${drafts.length}`)
  if (failed.length) {
    console.log('FAILED:')
    for (const f of failed) {
      console.log(`  ${f.id}: ${f.err}`)
      if (f.top) console.log(`    ${f.top}`)
    }
  }

  const reportPath = join(__dirname, 'puzzle-redesign-report.json')
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ok: results.map((p, i) => {
          const d = drafts[i] // wrong index if failures — store meta separately
          return p
        }),
        failed,
        meta: results.map((p) => {
          const a = analyze(drafts.find((x) => x.id === p._id)!)
          return a.ok
            ? { id: p._id, bestSh: a.bestSh, bestTot: a.bestTot, gap: a.gap, keep: a.keepBest, rec: a.recommended }
            : { id: p._id }
        }),
      },
      null,
      2
    )
  )

  if (failed.length === 0 && results.length === 48) {
    const exportPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-export.json')
    const ndjson = results.map((p) => JSON.stringify(p)).join('\n') + '\n'
    writeFileSync(exportPath, ndjson)

    const dataPath = join(__dirname, '../cloudfunctions/importPuzzles/puzzles-data.js')
    const jsArr = results.map((p) => {
      const { _id, ...rest } = p
      return { id: _id, ...rest }
    })
    writeFileSync(
      dataPath,
      `// 自动生成：主库拆搭题 p01–p48（定缺两门）\n// 导入完成后可按需删除 importPuzzles 云函数\nmodule.exports = ${JSON.stringify(jsArr)}\n`
    )
    console.log('wrote puzzles-export.json + puzzles-data.js')
  } else {
    console.log('skip export write until all 48 pass')
  }
}

main()
