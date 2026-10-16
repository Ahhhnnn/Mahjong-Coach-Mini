const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const clone = (value) => value === undefined ? undefined : structuredClone(value)
const compare = (a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id)

function load(relativePath, injected = {}, cache = new Map()) {
  let file = path.resolve(__dirname, '..', relativePath)
  if (!path.extname(file)) file += '.ts'
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'))
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const source = fs.readFileSync(file, 'utf8')
  const js = file.endsWith('.ts') ? ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText : source
  const localRequire = (name) => name in injected ? injected[name]
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name), injected, cache) : require(name)
  vm.runInThisContext(`(function(require, module, exports) { ${js}\n})`, { filename: file })(localRequire, module, module.exports)
  return module.exports
}

const seeds = JSON.parse(JSON.stringify(load('src/core/default-matches').createDefaultMatches()))

function server() {
  let openid = 'owner'
  const documents = new Map()
  const writes = []
  let failId
  const condition = (doc, fields) => Object.entries(fields).every(([key, value]) => {
    if (value?.operator === 'lte') return doc[key] <= value.value
    if (value?.operator === 'neq') return doc[key] !== value.value
    return doc[key] === value
  })
  function query(fields = {}, order = [], offset = 0, limit = 100) {
    return {
      where: (next) => query(next, order, offset, limit),
      orderBy: (key, direction) => query(fields, [...order, [key, direction]], offset, limit),
      skip: (next) => query(fields, order, next, limit),
      limit: (next) => query(fields, order, offset, next),
      async get() {
        const data = [...documents.values()].filter((doc) => condition(doc, fields)).sort((a, b) => {
          for (const [key, direction] of order) {
            const delta = typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key]))
            if (delta) return direction === 'asc' ? delta : -delta
          }
          return 0
        })
        return { data: clone(data.slice(offset, offset + limit)) }
      },
      async update({ data }) {
        let updated = 0
        for (const [id, doc] of documents) if (condition(doc, fields)) {
          documents.set(id, { ...doc, ...clone(data) })
          writes.push({ operation: 'update', ...clone(data) })
          updated++
        }
        return { stats: { updated } }
      },
    }
  }
  const collection = () => ({
    ...query(),
    doc: (id) => ({
      get: async () => ({ data: documents.has(id) ? [clone(documents.get(id))] : [] }),
      update: ({ data }) => query({ _id: id }).update({ data }),
    }),
    async add({ data }) {
      if (data.id === failId) throw new Error('simulated network failure')
      if (documents.has(data._id)) throw new Error('duplicate _id')
      documents.set(data._id, clone(data))
      writes.push({ operation: 'add', ...clone(data) })
      return { _id: data._id }
    },
  })
  const db = {
    collection, createCollection: async () => {}, serverDate: () => ({ serverDate: true }),
    command: { lte: (value) => ({ operator: 'lte', value }), neq: (value) => ({ operator: 'neq', value }) },
  }
  const sdk = { init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) }
  const injected = { 'wx-server-sdk': sdk }
  return {
    save: load('cloudfunctions/saveMatch/index.js', injected).main,
    list: load('cloudfunctions/getMatches/index.js', injected).main,
    remove: load('cloudfunctions/removeMatch/index.js', injected).main,
    documents, writes, setOwner: (value) => { openid = value }, failOn: (id) => { failId = id },
    seed() {
      seeds.forEach((record, index) => documents.set(`imported-${index}`, { ...clone(record), _id: `imported-${index}`, _openid: openid }))
    },
  }
}

function client(callFunction, initial = {}) {
  const storage = new Map(Object.entries(clone(initial)))
  const taro = {
    getStorageSync: (key) => clone(storage.get(key)),
    setStorageSync: (key, value) => storage.set(key, clone(value)),
    cloud: { callFunction },
  }
  return { storage, service: load('src/core/match-service', { '@tarojs/taro': taro }) }
}

test('归档的 21 场数据与原始来源一致，保留时间顺序', () => {
  const frontend = load('src/core/default-matches').createDefaultMatches()
  assert.deepEqual(JSON.parse(JSON.stringify(frontend)), seeds)
  assert.equal(seeds.length, 21)
  assert.deepEqual(seeds, seeds.slice().sort(compare))
})

test('缺少历史记录时反复读取也不会重新导入', async () => {
  const cloud = server()
  cloud.seed()
  cloud.documents.delete('imported-0')
  const before = clone([...cloud.documents])
  for (let i = 0; i < 3; i++) {
    const result = await cloud.list()
    assert.equal(result.matches.length, 20)
  }
  assert.deepEqual([...cloud.documents], before)
  assert.equal(cloud.writes.length, 0)
})

test('新设备和空账号只读取云端，不自动生成本地或云端默认数据', async () => {
  const cloud = server()
  const calls = []
  const local = client(async ({ name }) => {
    calls.push(name)
    assert.equal(name, 'getMatches')
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }) })
  assert.equal(local.service.listMatches().length, 0)
  await local.service.syncCloudMatchesToLocal()
  await local.service.syncCloudMatchesToLocal()
  assert.deepEqual(calls, ['getMatches', 'getMatches'])
  assert.equal(local.service.listMatches().length, 0)
  assert.equal(cloud.documents.size, 0)
})

test('读取已经完成初始化的 21 场记录只恢复缓存，不回写历史', async () => {
  const cloud = server()
  cloud.seed()
  const local = client(async ({ name }) => {
    assert.equal(name, 'getMatches')
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }) })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 21)
  assert.deepEqual(local.service.listMatches(), local.service.listMatches().slice().sort(compare))
  assert.equal(cloud.writes.length, 0)
})

test('页面手动保存只写入明确录入的一场，并发或网络重试不重复插入', async () => {
  const cloud = server()
  const manual = { ...seeds[0], id: 'manual-new', updatedAt: Date.now() }
  await Promise.all([cloud.save(manual), cloud.save(manual)])
  await cloud.save(manual)
  const result = await cloud.list()
  assert.equal(result.matches.length, 1)
  assert.equal(result.matches[0].id, manual.id)
  assert.equal(cloud.documents.size, 1)
  assert.equal(cloud.writes.length, 1)
})

test('云端已编辑的默认历史不会被本地旧缓存覆盖', async () => {
  const cloud = server()
  cloud.seed()
  const edited = cloud.documents.get('imported-0')
  edited.note = 'edited on another device'
  edited.updatedAt += 1000
  const local = client(async ({ name }) => {
    assert.equal(name, 'getMatches')
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }), match_records: seeds })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatch(edited.id).note, edited.note)
  assert.equal(cloud.writes.length, 0)
})

test('修改手动对局的日期后重新排序，较晚到达的旧请求不会覆盖新编辑', async () => {
  const cloud = server()
  cloud.seed()
  const early = { ...seeds[0], id: 'manual-early', playedAt: seeds[0].playedAt - 1000, updatedAt: Date.now() }
  const late = { ...early, id: 'manual-late', playedAt: seeds.at(-1).playedAt + 1000 }
  await cloud.save(late)
  await cloud.save(early)
  const result = await cloud.list()
  assert.equal(result.matches[0].id, early.id)
  assert.equal(result.matches.at(-1).id, late.id)
  await cloud.save({ ...late, playedAt: early.playedAt - 1000, note: 'newer edit', updatedAt: late.updatedAt + 1000 })
  await cloud.save(late)
  const updated = await cloud.list()
  assert.equal(updated.matches[0].id, late.id)
  assert.equal(updated.matches[0].note, 'newer edit')
})

test('已删除的历史不会因换设备、旧缓存或初始化入口再次调用而复活', async () => {
  const cloud = server()
  cloud.seed()
  await cloud.remove({ id: seeds[0].id })
  assert.equal((await cloud.save({ ...seeds[0], updatedAt: Date.now() })).deleted, true)
  const local = client(async ({ name }) => {
    assert.equal(name, 'getMatches')
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }), match_records: seeds })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 20)
  assert.equal(local.service.getMatch(seeds[0].id), undefined)
})

test('云端直接缺少的历史不会被不带待保存标记的本地旧数据补回', async () => {
  const cloud = server()
  cloud.seed()
  cloud.documents.delete('imported-0')
  const local = client(async ({ name }) => {
    assert.equal(name, 'getMatches')
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }), match_records: seeds })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 20)
  assert.equal(cloud.documents.size, 20)
  assert.equal(cloud.writes.length, 0)
})

test('普通保存按真实调用身份隔离账号，拒绝无身份保存', async () => {
  const cloud = server()
  const manual = { ...seeds[0], id: 'manual', updatedAt: Date.now() }
  cloud.setOwner(undefined)
  assert.equal((await cloud.save(manual)).ok, false)
  cloud.setOwner('owner')
  await cloud.save(manual)
  cloud.setOwner('other-owner')
  assert.equal((await cloud.list()).matches.length, 0)
  await cloud.save(manual)
  assert.equal((await cloud.list()).matches.length, 1)
  assert.equal(cloud.documents.size, 2)
})

test('分页读取超过 100 场记录，不补入默认数据，也不截断历史', async () => {
  const cloud = server()
  for (let index = 0; index < 325; index++) {
    const record = { ...seeds[0], id: `history-${index}`, _id: `history-${index}`, _openid: 'owner', playedAt: seeds[0].playedAt + index }
    cloud.documents.set(record._id, clone(record))
  }
  const result = await cloud.list()
  assert.equal(result.matches.length, 325)
  assert.deepEqual(result.matches, result.matches.slice().sort(compare))
  assert.equal(cloud.writes.length, 0)
})

test('离线页面新增与编辑按发生时间排序，并保留待上传标记', () => {
  const local = client(async () => { throw new Error('offline') })
  const latest = { ...seeds[0], id: 'manual-latest', playedAt: seeds.at(-1).playedAt + 1000 }
  const earliest = { ...seeds[0], id: 'manual-earliest', playedAt: seeds[0].playedAt - 1000 }
  local.service.upsertMatch(latest)
  local.service.upsertMatch(earliest)
  assert.equal(local.service.listMatches().length, 2)
  assert.equal(local.service.listMatches()[0].id, earliest.id)
  assert.equal(local.service.listMatches().at(-1).id, latest.id)
  local.service.upsertMatch({ ...latest, playedAt: earliest.playedAt - 1000 })
  assert.equal(local.service.listMatches()[0].id, latest.id)
  assert.deepEqual(local.storage.get('match_pending_saves').sort(), [earliest.id, latest.id].sort())
})

test('读取期间页面继续编辑或删除，会排队调用普通接口补同步', async () => {
  const cloud = server()
  cloud.seed()
  const requests = []
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const local = client(async ({ name, data }) => {
    requests.push({ name, data: clone(data) })
    if (requests.length === 1) await gate
    const result = name === 'getMatches' ? await cloud.list() : name === 'saveMatch' ? await cloud.save(data) : await cloud.remove(data)
    return { result }
  }, { user_info: JSON.stringify({ openid: 'owner' }), match_records: seeds })
  const syncing = local.service.syncCloudMatchesToLocal()
  local.service.upsertMatch({ ...seeds[0], note: 'edited while reading' })
  local.service.removeMatch(seeds[1].id)
  release()
  await syncing
  assert.deepEqual(requests.map((request) => request.name), ['getMatches', 'removeMatch', 'saveMatch', 'getMatches'])
  assert.equal(local.service.getMatch(seeds[0].id).note, 'edited while reading')
  assert.equal(local.service.getMatch(seeds[1].id), undefined)
  assert.deepEqual(local.storage.get('match_pending_saves'), [])
})

test('上传期间同一场再次编辑不会误清待上传标记', async () => {
  const cloud = server()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let saves = 0
  const local = client(async ({ name, data }) => {
    if (name === 'saveMatch') {
      if (++saves === 1) await gate
      return { result: await cloud.save(data) }
    }
    return { result: await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }) })
  local.service.upsertMatch({ ...seeds[0], id: 'manual', note: 'first edit' })
  const syncing = local.service.syncCloudMatchesToLocal()
  local.service.upsertMatch({ ...seeds[0], id: 'manual', note: 'second edit' })
  release()
  await syncing
  assert.equal(saves, 2)
  assert.equal((await cloud.list()).matches[0].note, 'second edit')
  assert.deepEqual(local.storage.get('match_pending_saves'), [])
})

test('离线保存失败保留待上传对局，恢复联网只上传页面新录入的一场', async () => {
  let offline = true
  const cloud = server()
  const local = client(async ({ name, data }) => {
    if (offline) throw new Error('offline')
    assert.ok(['saveMatch', 'getMatches'].includes(name))
    return { result: name === 'saveMatch' ? await cloud.save(data) : await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }) })
  local.service.upsertMatch({ ...seeds[0], id: 'manual-offline' })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.listMatches().length, 1)
  assert.equal(cloud.documents.size, 0)
  offline = false
  await local.service.syncCloudMatchesToLocal()
  assert.equal(cloud.documents.size, 1)
  assert.equal(local.service.listMatches().length, 1)
  assert.deepEqual(local.storage.get('match_pending_saves'), [])
})

test('旧页面保存另一设备已删除的对局时，清理待上传状态并保留云端删除', async () => {
  const cloud = server()
  cloud.seed()
  await cloud.remove({ id: seeds[0].id })
  const local = client(async ({ name, data }) => ({
    result: name === 'saveMatch' ? await cloud.save(data) : await cloud.list(),
  }), { user_info: JSON.stringify({ openid: 'owner' }), match_records: seeds })
  local.service.upsertMatch({ ...seeds[0], note: 'edit from stale page' })
  await local.service.syncCloudMatchesToLocal()
  assert.equal(local.service.getMatch(seeds[0].id), undefined)
  assert.deepEqual(local.storage.get('match_pending_saves'), [])
  assert.equal((await cloud.list()).matches.length, 20)
})

test('升级前离线手动录入的对局仍能上传，默认历史不会进入迁移保存队列', async () => {
  const cloud = server()
  cloud.seed()
  const manual = { ...clone(seeds[0]), id: 'm_legacy_offline', updatedAt: Date.now() }
  manual.players.find((player) => player.isSelf).name = '我'
  const saves = []
  const local = client(async ({ name, data }) => {
    if (name === 'saveMatch') saves.push(data.id)
    return { result: name === 'saveMatch' ? await cloud.save(data) : await cloud.list() }
  }, { user_info: JSON.stringify({ openid: 'owner' }), match_records: [...seeds, manual] })
  await local.service.syncCloudMatchesToLocal()
  await local.service.syncCloudMatchesToLocal()
  assert.deepEqual(saves, [manual.id])
  assert.equal(cloud.documents.size, 22)
  assert.equal(local.service.listMatches().length, 22)
  assert.deepEqual(local.storage.get('match_pending_saves'), [])
})

test('前后端都拒绝新增金额对局，原始积分历史保持不变', async () => {
  const cloud = server()
  cloud.seed()
  const legacy = { ...clone(seeds[0]), id: 'legacy-money', settleUnit: 'money' }
  const local = client(async () => { throw new Error('offline') }, { match_records: seeds })
  assert.throws(() => local.service.upsertMatch(legacy), /仅支持积分/)
  assert.equal((await cloud.save(legacy)).ok, false)
  assert.equal(local.service.listMatches().length, 21)
  assert.equal(cloud.documents.size, 21)
  assert.equal(cloud.writes.length, 0)
})
