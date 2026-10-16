const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = require('../src/content/default-matches.json')

function engine(initial = {}) {
  const storage = new Map(Object.entries(structuredClone(initial)))
  const taro = { getStorageSync: (key) => structuredClone(storage.get(key)), setStorageSync: (key, value) => storage.set(key, structuredClone(value)) }
  const cache = new Map()
  function load(file) {
    file = path.resolve(__dirname, '..', file.endsWith('.ts') || file.endsWith('.json') ? file : `${file}.ts`)
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'))
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
    const requireLocal = (name) => name === '@tarojs/taro' ? taro : load(path.resolve(path.dirname(file), name))
    vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename: file })(requireLocal, module, module.exports)
    return module.exports
  }
  return { ...load('src/core/match-badge-service'), seeds: load('src/core/default-matches').createDefaultMatches(), storage }
}

function game(id, scores) {
  return {
    id: String(id), playedAt: Date.UTC(2026, 0, Number(id) + 1), settleUnit: 'score', variant: 'xuezhan',
    players: ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN'].map((name, index) => ({ name, isSelf: index === 0, scoreDelta: scores[index] })),
  }
}

test('原始 21 场只有十场老将、送财童子达标；单场最高 70 分不授予破百', () => {
  const { updateMatchBadges, seeds } = engine()
  const badges = updateMatchBadges(seeds)
  assert.equal(Math.max(...source.rounds.map((r) => r.scores.find((p) => p.player === 'HENING').score)), 70)
  assert.deepEqual(badges.filter((b) => b.unlockedAt).map((b) => b.id).sort(), ['piggy_bank', 'regular_10'])
  assert.equal(badges.find((b) => b.id === 'century').current, 70)
  assert.equal(badges.find((b) => b.id === 'century').progress, 70)
  assert.equal(badges.find((b) => b.id === 'skyrocket').unlockedAt, undefined)
  assert.equal(badges.find((b) => b.id === 'runner_up_5').current, 2)
  assert.equal(badges.find((b) => b.id === 'win_streak_3').current, 2)
  assert.equal(badges.find((b) => b.id === 'lose_streak_3').current, 2)
  assert.equal(badges.find((b) => b.id === 'regular_10').unlockedAt, Date.parse('2026-08-14T19:00:00+08:00'))
  assert.equal(badges.find((b) => b.id === 'piggy_bank').unlockedAt, Date.parse('2026-07-31T19:00:00+08:00'))
})

test('撤回误授并将旧缓存时间修正为首次达标牌局时间，已读状态不变', () => {
  const old = { unlocked: { regular_10: 123, century: 234, skyrocket: 345, win_streak_3: 456, roller_coaster: 567 }, seen: ['regular_10', 'century', 'skyrocket'] }
  const api = engine({ match_badges_v1: old })
  const badges = api.updateMatchBadges(api.seeds)
  const expected = Date.parse('2026-08-14T19:00:00+08:00')
  assert.equal(badges.find((b) => b.id === 'regular_10').unlockedAt, expected)
  assert.equal(api.storage.get('match_badges_v1').unlocked.regular_10, expected)
  for (const id of ['century', 'skyrocket', 'win_streak_3', 'roller_coaster']) assert.equal(badges.find((b) => b.id === id).unlockedAt, undefined)
  assert.deepEqual(Object.keys(api.storage.get('match_badges_v1').unlocked).sort(), ['piggy_bank', 'regular_10'])
  assert.deepEqual(api.storage.get('match_badges_v1').seen, ['regular_10'])
  assert.ok(!api.getPendingBadgeIds().includes('century'))
})

test('他人破百不授予本人；本人恰好 100、140 分按明确阈值授予', () => {
  const api = engine()
  let badges = api.updateMatchBadges([game(1, [10, 150, -80, -80])])
  assert.equal(badges.find((b) => b.id === 'century').unlockedAt, undefined)
  badges = api.updateMatchBadges([game(1, [100, -20, -30, -50])])
  assert.ok(badges.find((b) => b.id === 'century').unlockedAt)
  assert.equal(badges.find((b) => b.id === 'skyrocket').unlockedAt, undefined)
  badges = api.updateMatchBadges([game(1, [140, -20, -30, -90])])
  assert.ok(badges.find((b) => b.id === 'skyrocket').unlockedAt)
})

test('首战和连胜按一位排名授予，正分但非一位会中断连胜', () => {
  const api = engine()
  const records = [game(1, [20, 10, -10, -20]), game(2, [20, 30, -10, -40]), game(3, [20, 0, -10, -10])]
  let badges = api.updateMatchBadges(records)
  assert.ok(badges.find((b) => b.id === 'first_blood').unlockedAt)
  assert.equal(badges.find((b) => b.id === 'win_streak_3').current, 1)
  badges = api.updateMatchBadges([game(1, [20, 0, -10, -10]), game(2, [20, 0, -10, -10]), game(3, [20, 0, -10, -10])])
  assert.ok(badges.find((b) => b.id === 'win_streak_3').unlockedAt)
})

test('正分率和标准差至少需要十场样本，恰好 60% 正分率达标', () => {
  const api = engine()
  const records = Array.from({ length: 10 }, (_, i) => game(i, i < 6 ? [10, 0, -5, -5] : [-10, 0, 5, 5]))
  let badges = api.updateMatchBadges(records.slice(0, 9))
  assert.equal(badges.find((b) => b.id === 'sharp_shooter').unlockedAt, undefined)
  assert.equal(badges.find((b) => b.id === 'stable_rock').unlockedAt, undefined)
  badges = api.updateMatchBadges(records)
  assert.ok(badges.find((b) => b.id === 'sharp_shooter').unlockedAt)
  assert.ok(badges.find((b) => b.id === 'stable_rock').unlockedAt)
})

test('全员零分平局不算首战告捷、连续一位或连续垫底', () => {
  const api = engine()
  const badges = api.updateMatchBadges(Array.from({ length: 5 }, (_, i) => game(i, [0, 0, 0, 0])))
  for (const id of ['first_blood', 'win_streak_3', 'lose_streak_3']) assert.equal(badges.find((b) => b.id === id).unlockedAt, undefined)
})

test('匿名、旧金额、缺失分数或总分不平衡的对局不能授予徽章', () => {
  const api = engine()
  const invalid = [game(1, [150, -50, -50, -50]), game(2, [150, -50, -50, -50]), game(3, [150, -50, -50, -50]), game(4, [150, -50, -50, -49])]
  invalid[0].players[1].name = '玩家2'
  invalid[1].settleUnit = 'money'
  delete invalid[2].players[1].scoreDelta
  const badges = api.updateMatchBadges(invalid)
  assert.ok(badges.every((b) => !b.unlockedAt))
})

test('修改或删除唯一达标牌局后，徽章资格跟随真实历史更新', () => {
  const api = engine()
  const high = game(1, [100, -20, -30, -50])
  assert.ok(api.updateMatchBadges([high]).find((b) => b.id === 'century').unlockedAt)
  assert.equal(api.updateMatchBadges([game(1, [70, -20, -20, -30])]).find((b) => b.id === 'century').unlockedAt, undefined)
  assert.ok(api.updateMatchBadges([high]).find((b) => b.id === 'century').unlockedAt)
  assert.equal(api.updateMatchBadges([]).find((b) => b.id === 'century').unlockedAt, undefined)
})

test('10、25、50 场里程碑和五连一位、三连垫底均在达标时授予', () => {
  const api = engine()
  for (const [count, id] of [[10, 'regular_10'], [25, 'regular_25'], [50, 'regular_50']]) {
    const records = Array.from({ length: count }, (_, i) => game(i, [10, 0, -5, -5]))
    assert.equal(api.updateMatchBadges(records.slice(1)).find((b) => b.id === id).unlockedAt, undefined)
    assert.ok(api.updateMatchBadges(records).find((b) => b.id === id).unlockedAt)
    assert.equal(api.updateMatchBadges([...records].reverse()).find((b) => b.id === id).unlockedAt, records[count - 1].playedAt)
  }
  const wins = Array.from({ length: 5 }, (_, i) => game(i, [10, 0, -5, -5]))
  assert.ok(api.updateMatchBadges(wins).find((b) => b.id === 'win_streak_5').unlockedAt)
  assert.equal(api.updateMatchBadges(wins).find((b) => b.id === 'win_streak_5').unlockedAt, wins[4].playedAt)
  const losses = Array.from({ length: 3 }, (_, i) => game(i, [-10, 10, 0, 0]))
  assert.ok(api.updateMatchBadges(losses).find((b) => b.id === 'lose_streak_3').unlockedAt)
  assert.equal(api.updateMatchBadges(losses).find((b) => b.id === 'lose_streak_3').unlockedAt, losses[2].playedAt)
  const seconds = Array.from({ length: 5 }, (_, i) => game(i, [10, 20, -10, -20]))
  assert.ok(api.updateMatchBadges(seconds).find((b) => b.id === 'runner_up_5').unlockedAt)
  assert.equal(api.updateMatchBadges(seconds).find((b) => b.id === 'runner_up_5').unlockedAt, seconds[4].playedAt)
})

test('标准差 30、60 和单场负 100 的边界按规则计算', () => {
  const api = engine()
  for (const [delta, id] of [[30, 'stable_rock'], [60, 'roller_coaster']]) {
    const records = Array.from({ length: 10 }, (_, i) => game(i, i % 2 ? [delta, -delta, 0, 0] : [-delta, delta, 0, 0]))
    const badge = api.updateMatchBadges(records).find((b) => b.id === id)
    assert.equal(badge.current, delta)
    assert.ok(badge.unlockedAt)
  }
  assert.ok(api.updateMatchBadges([game(1, [-100, 100, 0, 0])]).find((b) => b.id === 'piggy_bank').unlockedAt)
})

test('乱序及补录按发生时间重算；编辑和删除后移至下一场首次达标牌局', () => {
  const api = engine()
  const early = { ...game(1, [100, -20, -30, -50]), createdAt: Date.now(), updatedAt: Date.now() }
  const later = game(3, [140, -20, -30, -90])
  const normal = game(2, [10, 0, -5, -5])
  const time = (records) => api.updateMatchBadges(records).find((b) => b.id === 'century').unlockedAt
  assert.equal(time([later, normal]), later.playedAt)
  api.markBadgesSeen(['century'])
  assert.equal(time([later, early, normal]), early.playedAt)
  assert.ok(!api.getPendingBadgeIds().includes('century'))
  assert.equal(time([later, { ...early, players: normal.players }, normal]), later.playedAt)
  assert.equal(time([normal, later]), later.playedAt)
  assert.equal(time([normal]), undefined)
})

test('正分率首次达标的时间由当时历史确定，不使用当前比例或录入时间', () => {
  const api = engine()
  const records = Array.from({ length: 20 }, (_, i) => game(i, i >= 5 ? [10, 0, -5, -5] : [-10, 0, 5, 5]))
  const badge = api.updateMatchBadges([...records].reverse()).find((b) => b.id === 'sharp_shooter')
  assert.equal(badge.current, 75)
  assert.equal(badge.unlockedAt, records[12].playedAt)
})

test('标准差首次达标的时间分别对应满足至少十场条件的历史节点', () => {
  const api = engine()
  const steady = Array.from({ length: 10 }, (_, i) => game(i, i % 2 ? [20, -20, 0, 0] : [-20, 20, 0, 0]))
  assert.equal(api.updateMatchBadges(steady).find((b) => b.id === 'stable_rock').unlockedAt, steady[9].playedAt)
  const volatile = [...steady, game(10, [300, -100, -100, -100]), game(11, [100, -20, -30, -50])]
  assert.equal(api.updateMatchBadges(volatile).find((b) => b.id === 'roller_coaster').unlockedAt, volatile[10].playedAt)
})
