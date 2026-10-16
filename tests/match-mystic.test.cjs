const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const cache = new Map()
function load(relativePath) {
  const file = path.resolve(__dirname, '..', /\.(ts|json)$/.test(relativePath) ? relativePath : `${relativePath}.ts`)
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'))
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename: file })(
    (name) => load(path.resolve(path.dirname(file), name)), module, module.exports)
  return module.exports
}
const { computeMatchMystic, formatMysticRate, formatMysticScore } = load('src/core/match-mystic-service')
const seeds = load('src/core/default-matches').createDefaultMatches()
const names = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
function game(id, scores = [0, 10, 10, -20], location = '棋多多', playedAt = Date.UTC(2026, 0, id + 1)) {
  return { id: String(id), playedAt, variant: 'xuezhan', settleUnit: 'score', location,
    players: names.map((name, index) => ({ name, isSelf: index === 0, scoreDelta: scores[index] })),
  }
}

test('原始 21 场评选 DUHAN、棋多多、宽叫，人物和地点数字可回溯', () => {
  const stats = computeMatchMystic(seeds)
  assert.equal(stats.games, 21)
  assert.deepEqual(stats.nemeses, ['DUHAN'])
  assert.deepEqual(stats.luckyPlaces, ['棋多多'])
  assert.deepEqual(stats.unluckyPlaces, ['宽叫'])
  assert.deepEqual(stats.opponents.map((p) => [p.name, p.ahead]), [['DUHAN', 14], ['WUYU', 13], ['TANGXIANG', 9]])
  assert.equal(formatMysticRate(stats.opponents[0].pressureRate), '66.7%')
  const lucky = stats.locations.find((p) => p.name === '棋多多')
  assert.equal(lucky.games, 10)
  assert.equal(lucky.average, 9.5)
  assert.equal(lucky.wins, 6)
  assert.equal(lucky.positiveRate, 60)
  assert.equal(lucky.matchIds.length, lucky.games)
  const worst = stats.locations.find((p) => p.name === '宽叫')
  assert.equal(worst.average, -52.2)
  assert.equal(worst.games, 5)
  const pending = stats.locations.find((p) => p.name === '四个朋友')
  assert.equal(pending.average, 38)
  assert.equal(pending.eligible, false)
})

test('四场只观察，恰好五场参与评选，并列冤家共同显示', () => {
  const records = Array.from({ length: 5 }, (_, i) => game(i, [-10, 20, 20, -30]))
  const four = computeMatchMystic(records.slice(0, 4))
  assert.deepEqual(four.nemeses, [])
  assert.deepEqual(four.unluckyPlaces, [])
  assert.ok(four.opponents.every((p) => !p.eligible))
  const five = computeMatchMystic(records)
  assert.deepEqual(five.nemeses, ['WUYU', 'TANGXIANG'])
  assert.deepEqual(five.unluckyPlaces, ['棋多多'])
  assert.deepEqual(five.luckyPlaces, [])
})

test('同分计入分母并单列；恰好 50% 不评为克星', () => {
  const records = Array.from({ length: 6 }, (_, i) => game(i, i < 3 ? [0, 10, 0, -10] : [0, 0, -10, 10]))
  const stats = computeMatchMystic(records)
  const person = stats.opponents.find((p) => p.name === 'WUYU')
  assert.deepEqual([person.ahead, person.behind, person.tied, person.pressureRate], [3, 0, 3, 50])
  assert.deepEqual(stats.nemeses, [])
  assert.deepEqual(stats.luckyPlaces, [])
  assert.deepEqual(stats.unluckyPlaces, [])
})

test('压制率优先于分差排序，分差相同使用固定玩家顺序', () => {
  const records = Array.from({ length: 5 }, (_, i) => game(i, i < 4 ? [0, 1, 1, -2] : [0, -100, -100, 200]))
  const stats = computeMatchMystic(records)
  assert.deepEqual(stats.opponents.map((p) => p.name), ['WUYU', 'TANGXIANG', 'DUHAN'])
  assert.equal(stats.opponents[0].averageGap, -19.2)
  assert.deepEqual(stats.nemeses, ['WUYU', 'TANGXIANG'])
})

test('福地和雷区按场均评选；并列共同展示，待观察地点排在后面', () => {
  const records = []
  for (const [location, score] of [['福地甲', 10], ['福地乙', 10], ['雷区甲', -20], ['雷区乙', -20]]) {
    for (let i = 0; i < 5; i++) records.push(game(records.length, [score, -score, 0, 0], location))
  }
  records.push(game(30, [100, -100, 0, 0], '待观察'))
  const stats = computeMatchMystic(records)
  assert.deepEqual(new Set(stats.luckyPlaces), new Set(['福地甲', '福地乙']))
  assert.deepEqual(new Set(stats.unluckyPlaces), new Set(['雷区甲', '雷区乙']))
  assert.equal(stats.locations.at(-1).name, '待观察')
})

test('全正分地点不生成雷区，全负分地点不生成福地', () => {
  for (const score of [10, -10]) {
    const stats = computeMatchMystic(Array.from({ length: 5 }, (_, i) => game(i, [score, -score, 0, 0])))
    assert.equal(stats.luckyPlaces.length, score > 0 ? 1 : 0)
    assert.equal(stats.unluckyPlaces.length, score < 0 ? 1 : 0)
  }
})

test('地点只去除首尾空白，空地点不参与地点分析但保留人物统计', () => {
  const records = [' 棋多多 ', '棋多多', '', undefined, '棋多多店'].map((location, i) => ({ ...game(i), location }))
  const stats = computeMatchMystic(records)
  assert.equal(stats.games, 5)
  assert.equal(stats.locations.length, 2)
  assert.equal(stats.locations.find((p) => p.name === '棋多多').games, 2)
  assert.equal(stats.opponents[0].games, 5)
})

test('排除金额、匿名、重复玩家、缺失或非有限积分、不平衡总分及无效时间', () => {
  const records = Array.from({ length: 8 }, (_, i) => game(i))
  records[0].settleUnit = 'money'
  records[1].players[1].name = '玩家2'
  records[2].players[2].name = 'WUYU'
  delete records[3].players[0].scoreDelta
  records[4].players[0].scoreDelta = Infinity
  records[5].players[0].scoreDelta = 1
  records[6].playedAt = NaN
  assert.deepEqual(computeMatchMystic(records).matchIds, ['7'])
})

test('按北京时间筛选季度和全年；空赛季无残留，未指定赛季为全部历史', () => {
  const records = [
    game(1, undefined, undefined, Date.parse('2025-12-31T23:59:59+08:00')),
    game(2, undefined, undefined, Date.parse('2026-03-31T23:59:59+08:00')),
    game(3, undefined, undefined, Date.parse('2026-04-01T00:00:00+08:00')),
  ]
  assert.equal(computeMatchMystic(records).games, 3)
  assert.deepEqual(computeMatchMystic(records, { year: 2026, period: 'Q1' }).matchIds, ['2'])
  assert.deepEqual(computeMatchMystic(records, { year: 2026, period: 'all' }).matchIds, ['2', '3'])
  assert.deepEqual(computeMatchMystic(records, { year: 2026, period: 'Q4' }), {
    games: 0, matchIds: [], opponents: [], locations: [], nemeses: [], luckyPlaces: [], unluckyPlaces: [],
  })
})

test('补录、编辑、删除后即时重算，牌局证据有序且不修改输入', () => {
  const records = [game(3), game(1), game(2), game(0), game(4)]
  const original = JSON.stringify(records)
  const stats = computeMatchMystic(records)
  assert.deepEqual(stats.matchIds, ['0', '1', '2', '3', '4'])
  assert.deepEqual(stats.opponents[0].matchIds, stats.matchIds)
  assert.equal(JSON.stringify(records), original)
  const edited = records.map((r) => r.id === '0' ? { ...r, location: '新地点' } : r)
  assert.equal(computeMatchMystic(edited).locations.find((p) => p.name === '棋多多').eligible, false)
  assert.equal(computeMatchMystic(records.slice(1)).nemeses.length, 0)
  assert.equal(computeMatchMystic([...records, game(5)]).games, 6)
})

test('格式化只影响显示，保留正负号并消除负零', () => {
  assert.equal(formatMysticScore(9.54), '+9.5 分')
  assert.equal(formatMysticScore(-0.01), '0 分')
  assert.equal(formatMysticRate(2 / 3 * 100), '66.7%')
})
