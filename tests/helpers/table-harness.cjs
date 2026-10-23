const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createHash } = require('node:crypto')
const clone = (value) => value === undefined ? undefined : structuredClone(value)
function load(relativePath, injected = {}, cache = new Map()) {
  let file = path.resolve(__dirname, '../..', relativePath)
  if (!path.extname(file)) file += '.ts'
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'))
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const source = fs.readFileSync(file, 'utf8')
  const js = file.endsWith('.ts') ? ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText : source
  const localRequire = (name) => name in injected ? injected[name]
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name), injected, cache) : require(name)
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, module, module.exports)
  return module.exports
}
const seeds = clone(load('src/core/default-matches').createDefaultMatches())
const hash = (value) => createHash('sha256').update(value).digest('hex')
const tableIdentity = (name = 'HENING') => ({ playerName: name, bindingId: `binding-${name}`, tableId: 'fixed-four', role: name === 'HENING' ? 'admin' : 'member' })
function server() {
  let openid = 'owner', tail = Promise.resolve()
  const collections = new Map()
  const writes = []
  const docs = (name) => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name) }
  const table = { ready: true, adminOpenid: 'owner', members: {
    HENING: { openid: 'owner', bindingId: 'binding-HENING' }, WUYU: {}, TANGXIANG: {}, DUHAN: {},
  } }
  docs('match_tables').set('fixed-four', table)
  function collection(name) {
    const documents = docs(name)
    const query = (fields = {}, offset = 0, limit = 100) => ({
      where: (next) => query(next, offset, limit), skip: (next) => query(fields, next, limit), limit: (next) => query(fields, offset, next),
      get: async () => ({ data: clone([...documents.values()].filter((d) => Object.entries(fields).every(([k, v]) => d[k] === v)).slice(offset, offset + limit)) }),
    })
    return { ...query(),
      doc: (id) => ({
        get: async () => ({ data: documents.has(id) ? clone({ ...documents.get(id), _id: id }) : undefined }),
        set: async ({ data }) => { documents.set(id, clone(data)); writes.push({ collection: name, id, ...clone(data) }); return { stats: { updated: 1 } } },
        update: async ({ data }) => { if (!documents.has(id)) throw new Error('document not exist'); documents.set(id, { ...documents.get(id), ...clone(data) }); writes.push({ collection: name, id, ...clone(data) }); return { stats: { updated: 1 } } },
      }),
      add: async ({ data }) => { const id = data._id || String(documents.size); documents.set(id, clone(data)); return { _id: id } },
    }
  }
  const db = { createCollection: async (name) => { docs(name) }, collection, serverDate: () => ({ serverDate: true }), runTransaction: (callback) => {
    const operation = tail.then(() => callback({ collection }))
    tail = operation.catch(() => {})
    return operation
  } }
  const sdk = { init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) }
  const main = load('cloudfunctions/matchTable/index.js', { 'wx-server-sdk': sdk }).main
  const request = (data, name = 'HENING') => main({ schemaVersion: 2, bindingId: tableIdentity(name).bindingId, ...data })
  return { main, request, documents: docs('table_matches'), reviews: docs('match_reviews'), tables: docs('match_tables'), writes,
    db, collections, login: load('cloudfunctions/loginUser/index.js', { 'wx-server-sdk': sdk }).main,
    setOwner: (value) => { openid = value },
    seed() { seeds.forEach((record) => {
      const { performance, reasons, result, ...rest } = record
      docs('table_matches').set(hash(`fixed-four:${record.id}`), { ...clone(rest), tableId: 'fixed-four', revision: 1 })
      if (performance || reasons?.length) docs('match_reviews').set(hash(`fixed-four:${record.id}:HENING`), { tableId: 'fixed-four', matchId: record.id, playerName: 'HENING', performance, reasons })
    }) },
    bind(name, owner = name.toLowerCase()) { const current = docs('match_tables').get('fixed-four'); current.members[name] = { openid: owner, bindingId: tableIdentity(name).bindingId }; return tableIdentity(name) },
  }
}
function client(callFunction, initial = {}, name = 'HENING') {
  const listeners = new Map()
  const storage = new Map(Object.entries(clone({ user_info: JSON.stringify({ openid: name === 'HENING' ? 'owner' : name.toLowerCase(), identity: tableIdentity(name) }), ...initial })))
  const taro = { getStorageSync: (key) => clone(storage.get(key)), setStorageSync: (key, value) => storage.set(key, clone(value)), removeStorageSync: (key) => storage.delete(key),
    eventCenter: { trigger: (event) => listeners.get(event)?.forEach((fn) => fn()), on: (event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn) }, off: (event, fn) => listeners.get(event)?.delete(fn) },
    cloud: { callFunction } }
  const cache = new Map(), injected = { '@tarojs/taro': taro }
  return { storage, taro, service: load('src/core/match-service', injected, cache), identity: load('src/core/table-identity-service', injected, cache),
    badges: load('src/core/match-badge-service', injected, cache), load: (file) => load(file, injected, cache) }
}
module.exports = { load, seeds, server, client, clone, hash, tableIdentity }
