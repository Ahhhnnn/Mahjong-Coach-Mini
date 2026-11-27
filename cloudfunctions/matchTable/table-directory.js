const { randomBytes } = require('crypto')
const TABLE_ID = 'fixed-four'
const FIXED_NAMES = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DIRECTORY = new Set(['createTable', 'listTables', 'previewTable', 'claimSeat', 'releaseSeat', 'dissolveTable'])

function cleanLabel(value, max) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (!text || [...text].length > max) return ''
  return text
}

function memberOf(table, openid, seats) {
  const playerName = seats.find((name) => table?.members?.[name]?.openid === openid)
  if (!playerName) return null
  return {
    playerName, bindingId: table.members[playerName].bindingId,
    role: table.adminOpenid === openid ? 'admin' : 'member', tableId: table.id || TABLE_ID,
  }
}

function summary(table, identity) {
  const seats = table.seats || FIXED_NAMES
  return {
    id: table.id || TABLE_ID,
    name: table.name || '常聚牌桌',
    seats,
    mySeat: identity.playerName,
    role: identity.role,
    bindingId: identity.bindingId,
    inviteCode: table.inviteCode || '',
    players: seats.map((name) => ({ name, claimed: !!table.members?.[name]?.openid })),
  }
}

function publicRecord(record, review) {
  const { id, playedAt, variant, settleUnit, location, note, createdAt, updatedAt, revision } = record
  return {
    id, playedAt, variant, settleUnit, location, note, createdAt, updatedAt, revision,
    players: record.players.map(({ name, scoreDelta }) => ({ name, scoreDelta })),
    ...(review ? { performance: review.performance, reasons: review.reasons } : {}),
  }
}

async function freshCode(db) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = [...randomBytes(6)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
    const existing = await db.collection('match_tables').where({ inviteCode: code }).limit(1).get()
    if (!existing.data.length) return code
  }
  return ''
}

async function handleDirectory({ event, db, openid, readDoc, fail, pages, hash }) {
  if (event.action === 'listTables') {
    const tables = []
    const fixed = await readDoc(db.collection('match_tables').doc(TABLE_ID))
    const fixedIdentity = fixed?.ready ? memberOf(fixed, openid, FIXED_NAMES) : null
    if (fixedIdentity) tables.push(summary({ ...fixed, id: TABLE_ID, name: '常聚牌桌' }, fixedIdentity))
    const memberships = await pages('table_memberships', { openid })
    for (const membership of memberships) {
      if (!membership?.tableId || membership.tableId === TABLE_ID) continue
      const table = await readDoc(db.collection('match_tables').doc(membership.tableId))
      if (!table?.ready || !Array.isArray(table.seats)) continue
      const identity = memberOf({ ...table, id: membership.tableId }, openid, table.seats)
      if (!identity || identity.bindingId !== membership.bindingId) continue
      tables.push(summary({ ...table, id: membership.tableId }, identity))
    }
    return { ok: true, tables }
  }
  if (event.action === 'previewTable') {
    const code = cleanLabel(event.inviteCode, 6).toUpperCase()
    if (code.length !== 6) return fail('INVALID', '请输入 6 位邀请码')
    const found = await db.collection('match_tables').where({ inviteCode: code, ready: true }).limit(1).get()
    const table = found.data[0]
    if (!table?.id || table.id === TABLE_ID || !Array.isArray(table.seats)) return fail('INVALID', '没有找到这张桌子')
    return {
      ok: true,
      table: {
        id: table.id, name: table.name, inviteCode: code,
        players: table.seats.map((name) => ({ name, claimed: !!table.members?.[name]?.openid })),
      },
    }
  }
  if (event.action === 'createTable') {
    const name = cleanLabel(event.name, 16)
    const seats = Array.isArray(event.seats) ? event.seats.map((seat) => cleanLabel(seat, 12)) : []
    const mySeat = cleanLabel(event.mySeat, 12)
    if (!name || seats.length !== 4 || seats.some((seat) => !seat) || new Set(seats.map((seat) => seat.toLocaleLowerCase())).size !== 4 || !seats.includes(mySeat)) {
      return fail('INVALID', '请填写桌名、四个不重复的座位，并选择自己的座位')
    }
    const owned = await db.collection('match_tables').where({ createdBy: openid, ready: true }).limit(20).get()
    if (owned.data.length >= 10) return fail('LIMIT', '最多创建 10 张桌子')
    const joined = await db.collection('table_memberships').where({ openid }).limit(30).get()
    if (joined.data.length >= 20) return fail('LIMIT', '最多加入 20 张桌子')
    const inviteCode = await freshCode(db)
    if (!inviteCode) return fail('SERVER_ERROR', '暂时无法生成邀请码，请重试')
    const id = `t_${randomBytes(8).toString('hex')}`
    const bindingId = randomBytes(16).toString('hex')
    const now = Date.now()
    const members = {}
    seats.forEach((seat) => { members[seat] = { openid: null, bindingId: null } })
    members[mySeat] = { openid, bindingId, claimedAt: now }
    const table = {
      id, ready: true, name, seats, members, inviteCode, adminOpenid: openid, createdBy: openid, createdAt: now,
    }
    await db.collection('match_tables').doc(id).set({ data: table })
    await db.collection('table_memberships').doc(hash(`${openid}:${id}`)).set({ data: {
      id: hash(`${openid}:${id}`), openid, tableId: id, playerName: mySeat, bindingId, role: 'admin', updatedAt: now,
    } })
    return { ok: true, table: summary(table, { playerName: mySeat, bindingId, role: 'admin', tableId: id }) }
  }
  if (!['claimSeat', 'releaseSeat', 'dissolveTable'].includes(event.action)) return fail('INVALID', '未知操作')
  if (event.tableId === TABLE_ID || !event.tableId) return fail('INVALID', '常聚牌桌请到身份页认领')
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection('match_tables').doc(event.tableId)
    const current = await readDoc(ref)
    if (!current?.ready || !Array.isArray(current.seats)) return fail('INVALID', '这张桌子不存在')
    const mine = memberOf({ ...current, id: event.tableId }, openid, current.seats)
    if (event.action === 'dissolveTable') {
      if (mine?.role !== 'admin') return fail('FORBIDDEN', '只有创建者可以解散空桌子')
      const matches = await pages('table_matches', { tableId: event.tableId })
      if (matches.some((match) => !match._deleted)) return fail('INVALID', '这张桌子已经有牌局，不能解散')
      const memberships = await pages('table_memberships', { tableId: event.tableId })
      for (const membership of memberships) {
        if (membership?.id) await transaction.collection('table_memberships').doc(membership.id).remove()
      }
      await ref.update({ data: { ready: false, inviteCode: '', updatedAt: db.serverDate() } })
      return { ok: true, dissolved: true }
    }
    const seat = cleanLabel(event.playerName, 12)
    if (!current.seats.includes(seat)) return fail('INVALID', '请选择这张桌子上的座位')
    if (event.action === 'claimSeat') {
      if (mine && mine.playerName !== seat) return fail('ALREADY_BOUND', '你在这张桌子已经有座位')
      if (mine?.playerName === seat) return { ok: true, table: summary({ ...current, id: event.tableId }, mine) }
      if (current.members?.[seat]?.openid) return fail('TAKEN', '这个座位已被认领')
      const joined = await db.collection('table_memberships').where({ openid }).limit(30).get()
      if (joined.data.length >= 20) return fail('LIMIT', '最多加入 20 张桌子')
      const bindingId = randomBytes(16).toString('hex')
      const members = { ...current.members, [seat]: { openid, bindingId, claimedAt: Date.now() } }
      await ref.update({ data: { members, updatedAt: db.serverDate() } })
      const membershipId = hash(`${openid}:${event.tableId}`)
      await transaction.collection('table_memberships').doc(membershipId).set({ data: {
        id: membershipId, openid, tableId: event.tableId, playerName: seat, bindingId, role: 'member', updatedAt: Date.now(),
      } })
      const identity = { playerName: seat, bindingId, role: current.adminOpenid === openid ? 'admin' : 'member', tableId: event.tableId }
      return { ok: true, table: summary({ ...current, id: event.tableId, members }, identity) }
    }
    if (mine?.role !== 'admin') return fail('FORBIDDEN', '只有创建者可以解除座位')
    if (seat === mine.playerName) return fail('INVALID', '不能解除创建者自己的座位')
    const previous = current.members?.[seat]
    const members = { ...current.members, [seat]: { openid: null, bindingId: null } }
    await ref.update({ data: { members, updatedAt: db.serverDate() } })
    if (previous?.openid) await transaction.collection('table_memberships').doc(hash(`${previous.openid}:${event.tableId}`)).remove()
    return { ok: true, table: summary({ ...current, id: event.tableId, members }, mine) }
  })
}

async function handleCustomMatch({ event, db, openid, readDoc, fail, pages, hash, REASONS }) {
  const table = await readDoc(db.collection('match_tables').doc(event.tableId))
  if (!table?.ready || !Array.isArray(table.seats) || table.seats.length !== 4) return fail('NOT_READY', '这张桌子不存在')
  const identity = memberOf({ ...table, id: event.tableId }, openid, table.seats)
  if (!identity || event.bindingId !== identity.bindingId) return fail('UNBOUND', '请先认领自己的座位')
  if (event.action === 'list') {
    const records = await pages('table_matches', { tableId: event.tableId })
    const reviews = await pages('match_reviews', { tableId: event.tableId, playerName: identity.playerName })
    const latest = memberOf({ ...await readDoc(db.collection('match_tables').doc(event.tableId)), id: event.tableId }, openid, table.seats)
    if (latest?.bindingId !== identity.bindingId) return fail('UNBOUND', '座位已解除，请重新认领')
    const byId = new Map(reviews.map((review) => [review.matchId, review]))
    return {
      ok: true, identity,
      matches: records.filter((record) => !record._deleted).map((record) => publicRecord(record, byId.get(record.id)))
        .sort((a, b) => a.playedAt - b.playedAt || a.id.localeCompare(b.id)),
      deletedIds: records.filter((record) => record._deleted).map((record) => record.id),
    }
  }
  if (!['save', 'remove'].includes(event.action)) return fail('INVALID', '未知操作')
  if (typeof event.id !== 'string' || !event.id || event.id.length > 128
    || !Number.isInteger(event.revision) || event.revision < 0
    || typeof event.mutationId !== 'string' || !event.mutationId || event.mutationId.length > 160) {
    return fail('INVALID', '牌局版本信息无效，请刷新后重试')
  }
  if (event.action === 'save') {
    const players = event.players
    if (!Number.isFinite(event.playedAt) || event.playedAt <= 0 || event.settleUnit !== 'score'
      || !Array.isArray(players) || players.length !== 4 || new Set(players.map((player) => player?.name)).size !== 4
      || players.some((player) => !player || !table.seats.includes(player.name) || !Number.isFinite(player.scoreDelta))
      || Math.abs(players.reduce((sum, player) => sum + player.scoreDelta, 0)) > 1e-6) {
      return fail('INVALID', '四人积分必须完整且合计为零')
    }
  }
  return db.runTransaction(async (transaction) => {
    const current = await readDoc(transaction.collection('match_tables').doc(event.tableId))
    const currentIdentity = memberOf({ ...current, id: event.tableId }, openid, current?.seats || [])
    if (!current?.ready || currentIdentity?.bindingId !== identity.bindingId) return fail('UNBOUND', '座位已解除，请重新认领')
    const ref = transaction.collection('table_matches').doc(hash(`${event.tableId}:${event.id}`))
    const previous = await readDoc(ref)
    if (previous?.lastMutationId === event.mutationId && previous?.lastBindingId === identity.bindingId) {
      return { ok: true, revision: previous.revision, deleted: !!previous._deleted }
    }
    if (previous?._deleted) return fail('DELETED', '这场牌局已经被删除')
    if ((previous?.revision || 0) !== event.revision || (event.action === 'remove' && !previous)) {
      return fail('CONFLICT', '牌局已被其他人修改，请刷新后重新编辑')
    }
    const now = Date.now()
    const revision = (previous?.revision || 0) + 1
    const metadata = {
      revision, lastMutationId: event.mutationId, lastBindingId: identity.bindingId,
      updatedBy: identity.playerName, updatedAt: now, updatedAtServer: db.serverDate(),
    }
    if (event.action === 'remove') {
      await ref.update({ data: { ...metadata, _deleted: true } })
      return { ok: true, revision, deleted: true }
    }
    await ref.set({ data: {
      id: event.id, tableId: event.tableId, variant: 'xuezhan', settleUnit: 'score', playedAt: event.playedAt,
      players: current.seats.map((name) => ({ name, scoreDelta: event.players.find((player) => player.name === name).scoreDelta })),
      location: typeof event.location === 'string' ? event.location.trim().slice(0, 100) : '',
      note: typeof event.note === 'string' ? event.note.trim().slice(0, 500) : '',
      createdAt: previous?.createdAt || now, createdBy: previous?.createdBy || identity.playerName,
      ...metadata,
    } })
    await transaction.collection('match_reviews').doc(hash(`${event.tableId}:${event.id}:${identity.playerName}`)).set({ data: {
      tableId: event.tableId, matchId: event.id, playerName: identity.playerName,
      performance: ['good', 'normal', 'mistake'].includes(event.performance) ? event.performance : null,
      reasons: Array.isArray(event.reasons) ? [...new Set(event.reasons.filter((reason) => REASONS.includes(reason)))] : [],
      updatedAt: now,
    } })
    return { ok: true, revision, updatedAt: now }
  })
}

module.exports = async function routeExtra(context) {
  const { event } = context
  if (DIRECTORY.has(event.action)) return handleDirectory(context)
  if (event.tableId && event.tableId !== TABLE_ID) return handleCustomMatch(context)
  return null
}
