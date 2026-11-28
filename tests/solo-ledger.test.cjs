const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load, client, server, seeds, clone, hash } = require('./helpers/table-harness.cjs')

function soloCloud() {
  let openid = 'owner'
  const documents = new Map()
  let tail = Promise.resolve()
  const collection = () => ({
    where(fields = {}) {
      const query = {
        skip() { return query }, limit() { return query },
        async get() {
          return { data: [...documents.values()].filter((item) => Object.entries(fields).every(([key, value]) => item[key] === value)) }
        },
      }
      return query
    },
    doc(id) {
      return {
        get: async () => ({ data: documents.has(id) ? { ...documents.get(id), _id: id } : undefined }),
        set: async ({ data }) => { documents.set(id, { ...data }); return {} },
        update: async ({ data }) => { if (!documents.has(id)) throw new Error('document not exist'); documents.set(id, { ...documents.get(id), ...data }); return {} },
      }
    },
  })
  const db = { collection, serverDate: () => ({ serverDate: true }), runTransaction: (callback) => {
    const operation = tail.then(() => callback({ collection }))
    tail = operation.catch(() => {})
    return operation
  } }
  const main = load('cloudfunctions/soloMatch/index.js', { 'wx-server-sdk': { init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) } }).main
  return { main, documents, setOwner: (value) => { openid = value } }
}

const record = { action: 'save', id: 's1', revision: 0, mutationId: 'create', playedAt: Date.UTC(2026, 5, 1), settleUnit: 'score', scoreDelta: 18, location: '家里' }

test('单人分数只写给当前账号，换账号读不到', async () => {
  const cloud = soloCloud()
  assert.equal((await cloud.main(record)).ok, true)
  assert.equal((await cloud.main({ action: 'list' })).matches[0].scoreDelta, 18)
  cloud.setOwner('friend')
  assert.deepEqual((await cloud.main({ action: 'list' })).matches, [])
  assert.equal((await cloud.main({ ...record, mutationId: 'steal' })).ok, true)
  assert.equal(cloud.documents.size, 2)
})

test('过期版本不覆盖云端，删除后不能被旧请求恢复', async () => {
  const cloud = soloCloud()
  await cloud.main(record)
  assert.equal((await cloud.main({ ...record, revision: 1, mutationId: 'edit', scoreDelta: 30 })).revision, 2)
  assert.equal((await cloud.main({ ...record, revision: 1, mutationId: 'stale', scoreDelta: 1 })).code, 'CONFLICT')
  assert.equal((await cloud.main({ action: 'list' })).matches[0].scoreDelta, 30)
  assert.equal((await cloud.main({ action: 'remove', id: 's1', revision: 2, mutationId: 'remove' })).ok, true)
  assert.equal((await cloud.main({ ...record, revision: 3, mutationId: 'resurrect', scoreDelta: 9 })).code, 'DELETED')
  assert.deepEqual((await cloud.main({ action: 'list' })).matches, [])
})

test('本地队列同步到云端后，空缓存能把分数拉回来', async () => {
  const cloud = soloCloud()
  const local = client(async ({ name, data }) => { assert.equal(name, 'soloMatch'); return { result: await cloud.main(data) } })
  const solo = local.load('src/core/solo-match-service')
  const saved = solo.upsertSoloMatch({ playedAt: Date.UTC(2026, 6, 2), scoreDelta: -6, location: '茶馆' })
  await solo.syncCloudSoloToLocal()
  assert.equal(solo.getSoloSyncState().pending, 0)
  local.storage.delete(solo.soloScope())
  await solo.syncCloudSoloToLocal()
  assert.equal(solo.listSoloMatches()[0].id, saved.id)
  assert.equal(solo.listSoloMatches()[0].scoreDelta, -6)
})

test('单人徽章按自己的正负分计算，不看四人名次', () => {
  const api = client(async () => ({ result: { ok: false } })).load('src/core/solo-badge-service')
  const games = (scores) => scores.map((score, index) => ({ id: String(index), playedAt: index + 1, scoreDelta: score, settleUnit: 'score' }))
  let badges = api.evaluateSoloBadges(games([8, -2, 4]))
  assert.equal(badges.find((badge) => badge.id === 'solo_open').unlockedAt, 1)
  assert.equal(badges.find((badge) => badge.id === 'solo_win_3').current, 1)
  badges = api.evaluateSoloBadges(games([1, 1, 1]))
  assert.ok(badges.find((badge) => badge.id === 'solo_win_3').unlockedAt)
  badges = api.evaluateSoloBadges(games([-1, -1, -1]))
  assert.equal(badges.find((badge) => badge.id === 'solo_open').unlockedAt, undefined)
  assert.ok(badges.find((badge) => badge.id === 'solo_lose_3').unlockedAt)
  badges = api.evaluateSoloBadges(games([100]))
  assert.ok(badges.find((badge) => badge.id === 'solo_century').unlockedAt)
  assert.equal(badges.find((badge) => badge.id === 'solo_sky').unlockedAt, undefined)
})

test('棋牌室按胜率汇总，平局不计入胜负，没填地点不进玄学', async () => {
  const mystic = client(async () => ({ result: { ok: false } })).load('src/core/solo-mystic-service')
  const game = (id, location, score) => ({ id, playedAt: id, settleUnit: 'score', scoreDelta: score, location })
  const lucky = [10, 8, 6, 4, 0].map((score, index) => game(index + 1, '如意棋牌', score))
  const unlucky = [-2, -4, -6, -8, -10].map((score, index) => game(index + 10, '巷口棋牌', score))
  const stats = mystic.computeSoloVenueMystic([...lucky, ...unlucky, game(20, '  如意棋牌  ', 2), game(21, '', 100)])
  const home = stats.venues.find((venue) => venue.name === '如意棋牌')
  const alley = stats.venues.find((venue) => venue.name === '巷口棋牌')
  assert.equal(home.games, 6)
  assert.equal(home.winRate, 100)
  assert.equal(alley.winRate, 0)
  assert.deepEqual(stats.luckyVenues, ['如意棋牌'])
  assert.deepEqual(stats.unluckyVenues, ['巷口棋牌'])
  assert.equal(stats.placedGames, 11)
  assert.equal(stats.games, 12)
  assert.equal(mystic.computeSoloVenueMystic([game(1, '新店', 1)]).venues[0].eligible, false)
})

test('现有四人牌局按每人分数初始化个人页，之后的四人记分也同步过去', async () => {
  const cloud = server()
  cloud.seed()
  for (const name of ['WUYU', 'TANGXIANG', 'DUHAN']) cloud.bind(name)
  const before = clone([...cloud.documents.values()])
  const tableBefore = clone(cloud.tables.get('fixed-four'))
  const seeded = await cloud.main({ schemaVersion: 2, action: 'seedSolo' })
  assert.equal(seeded.ok, true)
  assert.equal(seeded.mirrored, seeds.length * 4)
  assert.deepEqual([...cloud.documents.values()], before)
  assert.deepEqual(cloud.tables.get('fixed-four'), tableBefore)
  const solos = () => [...cloud.collections.get('solo_matches').values()]
  assert.equal(solos().length, seeds.length * 4)
  const sample = seeds[0]
  for (const name of ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']) {
    const mine = solos().find((item) => item.sourceMatchId === sample.id && item.ownerOpenid === (name === 'HENING' ? 'owner' : name.toLowerCase()))
    assert.equal(mine.scoreDelta, sample.players.find((player) => player.name === name).scoreDelta)
    assert.equal(mine.id, `tm:fixed-four:${sample.id}`)
  }
  const writes = cloud.writes.length
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'seedSolo' })).mirrored, 0)
  assert.equal(cloud.writes.length, writes)
  cloud.setOwner('stranger')
  assert.equal((await cloud.main({ schemaVersion: 2, action: 'seedSolo' })).mirrored, 0)
  cloud.setOwner('owner')
  const created = clone(seeds[0])
  created.id = 'new-game'
  created.revision = 0
  created.mutationId = 'create-new-game'
  created.players = created.players.map((player) => ({
    ...player,
    scoreDelta: player.name === 'HENING' ? 12 : player.name === 'WUYU' ? -4 : player.name === 'TANGXIANG' ? -3 : -5,
  }))
  assert.equal((await cloud.request({ action: 'save', ...created })).ok, true)
  assert.equal(solos().find((item) => item.sourceMatchId === 'new-game' && item.ownerOpenid === 'owner').scoreDelta, 12)
  assert.equal(solos().find((item) => item.sourceMatchId === 'new-game' && item.ownerOpenid === 'wuyu').scoreDelta, -4)
  assert.deepEqual(cloud.documents.get(hash(`fixed-four:${sample.id}`)), before.find((item) => item.id === sample.id))
  created.revision = 1
  created.mutationId = 'edit-new-game'
  created.players = created.players.map((player) => ({ ...player, scoreDelta: player.name === 'HENING' ? 20 : player.name === 'WUYU' ? -8 : player.name === 'TANGXIANG' ? -6 : -6 }))
  assert.equal((await cloud.request({ action: 'save', ...created })).ok, true)
  assert.equal(solos().find((item) => item.sourceMatchId === 'new-game' && item.ownerOpenid === 'owner').scoreDelta, 20)
  assert.equal((await cloud.request({ action: 'remove', id: 'new-game', revision: 2, mutationId: 'remove-new-game' })).ok, true)
  assert.ok(solos().filter((item) => item.sourceMatchId === 'new-game').every((item) => item._deleted))
  assert.equal(cloud.documents.get(hash(`fixed-four:${sample.id}`)).revision, 1)
  const local = client(async ({ data }) => ({ result: await cloud.main(data) }))
  await local.service.syncCloudMatchesToLocal()
  const solo = local.load('src/core/solo-match-service')
  const types = local.load('src/core/match-types')
  const directory = local.load('src/core/table-directory-service')
  assert.equal(directory.listVisibleTables()[0].id, 'fixed-four')
  assert.equal(directory.listVisibleTables()[0].name, '四个敌人')
  assert.equal(directory.findVisibleTable('fixed-four')?.mySeat, 'HENING')
  local.storage.delete(`table_directory_v1:${JSON.parse(local.storage.get('user_info')).openid}`)
  assert.equal(directory.findVisibleTable('fixed-four')?.name, '四个敌人')
  assert.equal(local.service.listMatches().length, seeds.length)
  const projected = solo.listSoloMatches()
  assert.equal(projected.length, seeds.length)
  const first = local.service.listMatches()[0]
  assert.equal(projected.find((item) => item.id === types.tableSoloId('fixed-four', first.id)).scoreDelta, first.players.find((player) => player.isSelf).scoreDelta)
  solo.upsertSoloMatch({ playedAt: Date.UTC(2026, 1, 2), scoreDelta: 3, location: '独自' })
  assert.equal(solo.listSoloMatches().length, seeds.length + 1)
  assert.throws(() => solo.removeSoloMatch(types.tableSoloId('fixed-four', first.id)), /四人牌局/)
  assert.equal(local.service.listMatches().length, seeds.length)
})

test('建桌座位名不能空、不能重复，单人分数不必和其他人合计为零', () => {
  const types = load('src/core/match-types')
  assert.equal(types.validateTableDraft('周五局', ['甲', '乙', '丙', '丁'], '甲'), undefined)
  assert.match(types.validateTableDraft('周五局', ['甲', '甲', '丙', '丁'], '甲'), /重复/)
  assert.match(types.validateTableDraft('', ['甲', '乙', '丙', '丁'], '甲'), /桌名/)
  const accepted = types.seatMatchRecords([{
    id: 'solo', playedAt: 1, settleUnit: 'score', result: 'win', createdAt: 1, updatedAt: 1,
    players: [{ name: '我', scoreDelta: 15 }],
  }], ['我'], '我')
  assert.equal(accepted.length, 1)
  assert.equal(accepted[0].result, 'win')
})
