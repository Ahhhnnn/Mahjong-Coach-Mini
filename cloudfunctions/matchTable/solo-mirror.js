const FIXED_NAMES = ['HENING', 'WUYU', 'TANGXIANG', 'DUHAN']

function seatsOf(table) {
  return Array.isArray(table?.seats) && table.seats.length === 4 ? table.seats : FIXED_NAMES
}

function soloId(tableId, matchId) {
  return `tm:${tableId}:${matchId}`
}

/** 把一场四人牌局里每个已认领座位的分数写成个人记录。不改牌局原文。 */
async function mirrorMatch({ writer, readDoc, hash, table, tableId, record, deleted }) {
  if (!record?.id) return 0
  let written = 0
  for (const name of seatsOf(table)) {
    const openid = table?.members?.[name]?.openid
    if (!openid) continue
    const score = record.players?.find((player) => player?.name === name)?.scoreDelta
    if (!deleted && !Number.isFinite(score)) continue
    const id = soloId(tableId, record.id)
    const ref = writer.collection('solo_matches').doc(hash(`${openid}:${id}`))
    const previous = await readDoc(ref)
    if (previous && previous.ownerOpenid !== openid) continue
    if (deleted) {
      if (previous && !previous._deleted) {
        await ref.update({ data: { _deleted: true, revision: (previous.revision || 0) + 1, updatedAt: Date.now(), source: 'table' } })
        written += 1
      }
      continue
    }
    const location = typeof record.location === 'string' ? record.location : ''
    const note = typeof record.note === 'string' ? record.note : ''
    if (previous && !previous._deleted && previous.scoreDelta === score && previous.playedAt === record.playedAt
      && (previous.location || '') === location && (previous.note || '') === note && previous.source === 'table') continue
    const now = Date.now()
    await ref.set({ data: {
      id, ownerOpenid: openid, source: 'table', sourceTableId: tableId, sourceMatchId: record.id,
      variant: 'xuezhan', settleUnit: 'score', playedAt: record.playedAt, scoreDelta: score,
      location, seat: '', note, performance: null, reasons: [],
      createdAt: previous?.createdAt || record.createdAt || now,
      revision: (previous?.revision || 0) + 1,
      lastMutationId: `mirror:${record.revision || 0}`,
      updatedAt: now,
    } })
    written += 1
  }
  return written
}

async function mirrorStored({ db, readDoc, hash, table, tableId, matchId }) {
  const stored = await readDoc(db.collection('table_matches').doc(hash(`${tableId}:${matchId}`)))
  if (!stored?.id) return 0
  return mirrorMatch({ writer: db, readDoc, hash, table, tableId, record: stored, deleted: !!stored._deleted })
}

async function seedTable({ db, readDoc, hash, pages, table, tableId }) {
  const matches = await pages('table_matches', { tableId })
  let written = 0
  for (const match of matches) {
    if (!match?.id || match._deleted) continue
    written += await mirrorMatch({ writer: db, readDoc, hash, table, tableId, record: match, deleted: false })
  }
  return written
}

async function safe(task) {
  try { return await task() }
  catch (error) { console.error('[matchTable] solo mirror', error); return 0 }
}

module.exports = { mirrorStored, seedTable, safe }
