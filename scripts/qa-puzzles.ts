import { readFileSync } from 'fs'
import { discardUkeire } from '../src/core/shanten'
import { countTiles, type Tile } from '../src/core/tiles'

const lines = readFileSync('./cloudfunctions/importPuzzles/puzzles-export.json', 'utf8').trim().split('\n')
const puzzles = lines.map((l) => JSON.parse(l))
const errors: string[] = []
const warns: string[] = []

if (puzzles.length !== 50) errors.push('count ' + puzzles.length)

for (const p of puzzles) {
  const melds = p.melds || []
  const expected = 14 - melds.length * 3
  if (p.hand.length !== expected) errors.push(p._id + ' handlen')
  const all = [...p.hand, ...melds.flatMap((m: { tiles: Tile[] }) => m.tiles)]
  const suits = new Set(all.map((t: string) => t[1]))
  if (suits.size > 2) errors.push(p._id + ' suits=' + [...suits].join(''))
  const c = countTiles(all as Tile[])
  for (const [t, n] of Object.entries(c)) if ((n as number) > 4) errors.push(p._id + ' ' + t + '=' + n)
  for (const m of melds) {
    if (![...suits].includes(m.tiles[0][1])) errors.push(p._id + ' meld suit')
  }
  const r = discardUkeire(p.hand as Tile[], undefined, melds.length)
  const ranked = Object.entries(r).sort(
    (a, b) => a[1].shanten - b[1].shanten || b[1].total - a[1].total
  )
  const bestSh = ranked[0][1].shanten
  const bestTot = ranked[0][1].total
  const rec = ranked
    .filter(([, v]) => v.shanten === bestSh && v.total === bestTot)
    .map(([t]) => t)
    .sort()
  const got = [...p.recommendedDiscards].sort()
  if (JSON.stringify(rec) !== JSON.stringify(got)) {
    errors.push(p._id + ' rec mismatch want=' + rec + ' got=' + got)
  }
  const tip: string = p.analysis?.tip || ''
  for (const t of p.recommendedDiscards as Tile[]) {
    const cn = '一二三四五六七八九'[+t[0] - 1] + (t[1] === 'm' ? '万' : t[1] === 'p' ? '筒' : '条')
    if (tip.includes(cn) || tip.includes(t)) warns.push(p._id + ' tip leaks ' + t)
  }
  if (p.difficulty < 3) warns.push(p._id + ' low diff')
  const same = ranked.filter(([, v]) => v.shanten === bestSh)
  if (bestSh === 0 && same.length <= 2 && got.length < 2) warns.push(p._id + ' obvious tenpai keep' + same.length)
  if (bestSh === 0 && same.length > 6) warns.push(p._id + ' easy tenpai keep' + same.length)

  // 一眼打孤幺九
  const allEdge = got.every((t) => t[0] === '1' || t[0] === '9')
  const next = same.find(([, v]) => v.total < bestTot)
  const gap = next ? bestTot - next[1].total : 99
  if (got.length === 1 && allEdge && (gap >= 4 || same.length <= 4)) {
    warns.push(p._id + ' orphan-cut ' + got[0] + ' gap' + gap)
  }
}

const chapters = readFileSync('./src/content/chapters.ts', 'utf8')
for (let i = 1; i <= 50; i++) {
  const id = 'p' + String(i).padStart(2, '0')
  if (!chapters.includes(`'${id}'`)) errors.push('chapter missing ' + id)
  if (!puzzles.find((p) => p._id === id)) errors.push('export missing ' + id)
}

const cd = readFileSync('./cloudfunctions/importPuzzles/chengdu-test-puzzles.json', 'utf8')
if (!cd.includes('cd01')) errors.push('chengdu file damaged')

const data = readFileSync('./cloudfunctions/importPuzzles/puzzles-data.js', 'utf8')
if (!data.includes('p01')) errors.push('data missing p01')
if (data.includes('"b01"') || data.includes("'b01'")) warns.push('data still has b01')

console.log('errors', errors.length ? errors : 'none')
console.log('warns', warns.length ? warns : 'none')
console.log('ok puzzles', puzzles.length)
