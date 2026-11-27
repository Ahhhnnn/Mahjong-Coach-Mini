const assert = require('node:assert/strict')
const { test } = require('node:test')
const { load, client } = require('./helpers/table-harness.cjs')

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

test('方位会写进云端，并按位置分别计算胜率和顺位', async () => {
  const cloud = soloCloud()
  assert.equal((await cloud.main({ ...record, seat: 'east' })).ok, true)
  assert.equal((await cloud.main({ action: 'list' })).matches[0].seat, 'east')
  assert.equal((await cloud.main({ ...record, id: 'bad-seat', mutationId: 'bad-seat', seat: '门口' })).ok, true)
  assert.equal((await cloud.main({ action: 'list' })).matches.find((item) => item.id === 'bad-seat').seat, '')
  const mystic = client(async () => ({ result: { ok: false } })).load('src/core/solo-mystic-service')
  const game = (id, seat, score) => ({ id, playedAt: id, settleUnit: 'score', scoreDelta: score, seat })
  const east = Array.from({ length: 5 }, (_, index) => game(index + 1, 'east', 10))
  const south = Array.from({ length: 5 }, (_, index) => game(index + 10, 'south', -4))
  const stats = mystic.computeSoloSeatMystic([...east, ...south, game(20, undefined, 100)])
  assert.equal(stats.seats.find((seat) => seat.seat === 'east').winRate, 100)
  assert.equal(stats.seats.find((seat) => seat.seat === 'south').winRate, 0)
  assert.deepEqual(stats.luckySeats, ['east'])
  assert.deepEqual(stats.unluckySeats, ['south'])
  assert.equal(stats.seatedGames, 10)
  assert.equal(stats.games, 11)
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
