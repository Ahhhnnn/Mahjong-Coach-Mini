const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// 使用项目已有的 TypeScript 编译器执行纯 core 模块，无需引入测试框架或 Taro 运行时。
const cache = new Map()
function load(relativePath) {
  const file = path.resolve(__dirname, '..', relativePath.endsWith('.ts') ? relativePath : `${relativePath}.ts`)
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const localRequire = (name) => load(path.resolve(path.dirname(file), name))
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: file })(localRequire, module, module.exports)
  return module.exports
}

const { FIXED_MATCH_PLAYERS, deriveMatchResult } = load('src/core/match-types')
const { computeMatchStats, filterBySeason, getMatchSeasonAt, matchSeasonBounds } = load('src/core/match-stats-service')
const time = (date) => Date.parse(`${date}+08:00`)

function record(id, date, delta = 10, unit = 'score') {
  return {
    id, playedAt: time(date), settleUnit: unit, variant: 'xuezhan',
    result: deriveMatchResult(delta), createdAt: time(date), updatedAt: time(date),
    players: FIXED_MATCH_PLAYERS.map((name, index) => ({
      name, isSelf: index === 0,
      [unit === 'score' ? 'scoreDelta' : 'moneyDelta']: index === 0 ? delta : index === 1 ? -delta : 0,
    })),
  }
}

test('当前季度按北京时间识别，覆盖四次季度切换与跨年', () => {
  for (const [date, year, period] of [
    ['2025-12-31T23:59:59.999', 2025, 'Q4'],
    ['2026-01-01T00:00:00', 2026, 'Q1'],
    ['2026-03-31T23:59:59.999', 2026, 'Q1'],
    ['2026-04-01T00:00:00', 2026, 'Q2'],
    ['2026-06-30T23:59:59.999', 2026, 'Q2'],
    ['2026-07-01T00:00:00', 2026, 'Q3'],
    ['2026-09-30T23:59:59.999', 2026, 'Q3'],
    ['2026-10-01T00:00:00', 2026, 'Q4'],
    ['2026-10-16T18:00:00', 2026, 'Q4'],
    ['2027-01-01T00:00:00', 2027, 'Q1'],
  ]) assert.deepEqual(getMatchSeasonAt(time(date)), { year, period })
})

test('季度和全年包含起始时刻、排除下一赛季起始时刻', () => {
  for (const period of ['all', 'Q1', 'Q2', 'Q3', 'Q4']) {
    const season = { year: 2026, period }
    const { start, end } = matchSeasonBounds(season)
    const records = [start - 1, start, end - 1, end].map((playedAt, index) => ({ id: index, playedAt }))
    assert.deepEqual(filterBySeason(records, season).map((r) => r.id), [1, 2])
  }
  assert.equal(matchSeasonBounds({ year: 2026, period: 'Q4' }).end, time('2027-01-01T00:00:00'))
})

test('闰年的二月二十九日属于 Q1，全年四个赛季无重叠或缺口', () => {
  const leapDay = record('leap', '2024-02-29T23:59:59.999')
  assert.equal(filterBySeason([leapDay], { year: 2024, period: 'Q1' }).length, 1)
  const annual = matchSeasonBounds({ year: 2024, period: 'all' })
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((period) => matchSeasonBounds({ year: 2024, period }))
  assert.equal(quarters[0].start, annual.start)
  assert.equal(quarters[3].end, annual.end)
  for (let i = 0; i < 3; i++) assert.equal(quarters[i].end, quarters[i + 1].start)
  assert.equal((annual.end - annual.start) / 86400000, 366)
})

const yearRecords = [
  record('q1-first', '2026-01-01T00:00:00', 10),
  record('q1-last', '2026-03-31T23:59:59.999', 20),
  record('q2-first', '2026-04-01T00:00:00', 30),
  record('q2-last', '2026-06-30T23:59:59.999', 40),
  record('q3-first', '2026-07-01T00:00:00', 50),
  record('q3-last', '2026-09-30T23:59:59.999', 60),
  record('q4-first', '2026-10-01T00:00:00', 70),
  record('q4-last', '2026-12-31T23:59:59.999', 80),
]
const records = [
  ...yearRecords,
  record('previous-year', '2025-12-31T23:59:59.999', 1000),
  record('next-year', '2027-01-01T00:00:00', 2000),
  record('money', '2026-02-01T12:00:00', -15, 'money'),
]

test('战绩、排名、曲线同属所选赛季，历史季度不受今天的滚动窗口影响', () => {
  const original = JSON.stringify(records)
  for (const [period, total, cumulative] of [['all', 8, 360], ['Q1', 2, 30], ['Q2', 2, 70], ['Q3', 2, 110], ['Q4', 2, 150]]) {
    const stats = computeMatchStats(records, { season: { year: 2026, period }, trendSpan: 'week' })
    assert.equal(stats.total, total)
    assert.equal(stats.cumulative, cumulative)
    assert.equal(stats.wins, total)
    assert.equal(stats.ranking.length, 4)
    assert.ok(stats.ranking.every((entry) => entry.games === total))
    assert.equal(stats.trend.points.length, total + 1)
    for (const series of stats.trend.series) {
      assert.equal(series.values[0], 0)
      assert.equal(series.total, series.values.at(-1))
      assert.equal(series.total, stats.ranking.find((entry) => entry.name === series.name).total)
    }
    assert.equal(stats.trend.series.find((series) => series.name === 'HENING').total, cumulative)
  }
  assert.equal(JSON.stringify(records), original)
})

test('全年只包含所选年份，历史年份可独立查看', () => {
  for (const [year, cumulative] of [[2025, 1000], [2027, 2000]]) {
    const stats = computeMatchStats(records, { season: { year, period: 'all' } })
    assert.equal(stats.total, 1)
    assert.equal(stats.cumulative, cumulative)
  }
})

test('旧金额存档不会参与赛季积分统计', () => {
  const stats = computeMatchStats(records, { season: { year: 2026, period: 'Q1' } })
  assert.equal(stats.total, 2)
  assert.equal(stats.cumulative, 30)
  assert.equal(stats.trend.series.find((series) => series.name === 'HENING').total, 30)
})

test('空赛季清空战绩、排行榜与曲线，不残留上次选择的数据', () => {
  const stats = computeMatchStats(records, { season: { year: 2025, period: 'Q1' } })
  assert.equal(stats.total, 0)
  assert.equal(stats.cumulative, 0)
  assert.equal(stats.winRate, 0)
  assert.deepEqual(stats.ranking, [])
  assert.deepEqual(stats.trend, { points: [], series: [] })
})

test('赛季中仍排除旧匿名记录；未传赛季时保留现有统计接口', () => {
  const anonymous = record('anonymous', '2026-01-02T12:00:00', 10000)
  anonymous.players[1].name = '玩家2'
  const stats = computeMatchStats([...records, anonymous], { season: { year: 2026, period: 'Q1' } })
  assert.equal(stats.total, 2)
  assert.equal(stats.cumulative, 30)
  assert.equal(computeMatchStats(records, { range: 'all' }).total, 10)
})
