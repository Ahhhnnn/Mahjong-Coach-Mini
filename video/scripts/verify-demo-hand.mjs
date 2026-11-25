import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function loadCoreModule(relPath) {
  const fullPath = path.join(repoRoot, relPath)
  const code = fs.readFileSync(fullPath, 'utf8')
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const mod = { exports: {} }
  const localRequire = (spec) => {
    if (spec === './tiles') return loadCoreModule('src/core/tiles.ts')
    throw new Error(`Unexpected import: ${spec}`)
  }
  const fn = new Function('require', 'module', 'exports', outputText)
  fn(localRequire, mod, mod.exports)
  return mod.exports
}

const { discardUkeire } = loadCoreModule('src/core/shanten.ts')

// 经典四川麻将（缺万，门清 14 张）六搭拆搭题：
// 2p 3p 4p (顺子) | 5p 6p (两面) | 8p 8p (对子定将) | 1s 2s (边张弱搭) | 4s 5s (两面) | 7s 8s 9s (顺子)
const hand14 = [
  '2p', '3p', '4p', '5p', '6p', '8p', '8p',
  '1s', '2s', '4s', '5s', '7s', '8s', '9s',
]

// 另一手：打 1s 立刻 1 向听，且 1s 为绝对唯一最优切牌（进张远大于拆两面/拆对子）
const analysis = discardUkeire(hand14)
const ranked = Object.entries(analysis)
  .map(([tile, info]) => ({ tile, ...info }))
  .sort((a, b) => a.shanten - b.shanten || b.total - a.total)

console.log('=== Verified Sichuan Mahjong 14-Tile Hand (via src/core/shanten.ts) ===')
console.log('Hand:', hand14.join(' '))
for (const row of ranked.slice(0, 6)) {
  const waitsStr = Object.entries(row.waits)
    .map(([t, c]) => `${t}(${c})`)
    .join(', ')
  console.log(`  打 ${row.tile.padEnd(3)} -> ${row.shanten} 向听 | 进张 ${String(row.total).padStart(2)} 张 | ${waitsStr}`)
}

// Verify assertions for demo data consistency
const best = ranked[0]
if (best.tile !== '1s' || best.shanten !== 1) {
  console.error('Unexpected optimal discard:', best)
  process.exit(1)
}
console.log(`\n[OK] Verified optimal discard: ${best.tile} (${best.shanten} 向听, ${best.total} 进张)`)
