const { randomInt, randomBytes } = require('crypto')
const ACTIONS = ['venueStatus', 'saveVenues', 'drawVenue', 'venueHistory']
const dayAt = (time) => new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 10)
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const fail = (code, msg) => ({ ok: false, code, msg })
const publicDraw = (row) => {
  if (!row) return null
  const { date, venue, candidates, configVersion, drawnBy, drawnAt } = row
  return { date, venue, candidates, configVersion, drawnBy, drawnAt }
}

module.exports = async function venueAction({ event, db, tableId, openid, readDoc, memberOf }) {
  if (!ACTIONS.includes(event.action)) return null
  const configRef = (source) => source.collection('table_venue_configs').doc(tableId)
  const authorized = async (source) => {
    const table = await readDoc(source.collection('match_tables').doc(tableId))
    const identity = memberOf(table, openid)
    return table?.ready && identity?.bindingId === event.bindingId ? { identity, table } : null
  }
  if (event.action === 'venueHistory') {
    if (event.before !== undefined && !validDate(event.before)) return fail('INVALID', '历史记录游标无效')
    const fields = { tableId, ...(event.before ? { date: db.command.lt(event.before) } : {}) }
    const result = await db.collection('table_venue_draws').where(fields).orderBy('date', 'desc').limit(21).get()
    if (!await authorized(db)) return fail('UNBOUND', '身份已解除，请重新认领')
    const items = result.data.slice(0, 20).map(publicDraw)
    return { ok: true, items, nextCursor: result.data.length > 20 ? items[items.length - 1].date : null }
  }
  return db.runTransaction(async (transaction) => {
    const member = await authorized(transaction)
    if (!member) return fail('UNBOUND', '身份已解除，请重新认领')
    const { identity, table } = member
    const now = Date.now()
    const today = dayAt(now)
    const maxDate = dayAt(now + 30 * 86400000)
    const ref = configRef(transaction)
    const config = await readDoc(ref) || { venues: [], version: 0 }
    if (event.action === 'saveVenues') {
      if (identity.role !== 'admin') return fail('FORBIDDEN', '仅管理员可以维护棋牌室')
      if (!Number.isInteger(event.version) || event.version < 0 || !Array.isArray(event.venues) || event.venues.length > 50) return fail('INVALID', '最多维护 50 家棋牌室')
      if (event.version !== config.version) return fail('CONFLICT', '名单已更新，请刷新后重新编辑')
      const venues = [], ids = new Set(), names = new Set()
      for (const item of event.venues) {
        if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 100 || typeof item.enabled !== 'boolean') return fail('INVALID', '棋牌室名称需为 1～100 字，并设置启用状态')
        const name = item.name.trim()
        if (names.has(name)) return fail('INVALID', '棋牌室名称不能重复')
        const id = item.id || randomBytes(12).toString('hex')
        if (typeof id !== 'string' || ids.has(id) || (item.id && !config.venues.some((v) => v.id === item.id))) return fail('INVALID', '棋牌室编号无效，请刷新后重试')
        ids.add(id); names.add(name); venues.push({ id, name, enabled: item.enabled })
      }
      if (config.venues.some((v) => !ids.has(v.id))) return fail('INVALID', '已有棋牌室请停用，不能删除')
      const next = { tableId, venues, version: config.version + 1, updatedBy: identity.playerName, updatedAt: now }
      await ref.set({ data: next })
      return { ok: true, config: next }
    }
    const date = event.targetDate === undefined ? today : event.targetDate
    if (!validDate(date)) return fail('INVALID_DATE', '请选择有效的牌局日期')
    const drawRef = transaction.collection('table_venue_draws').doc(`${tableId}_${date}`)
    const existing = await readDoc(drawRef)
    // 兼容旧版当天已抽取的记录；提前抽好的当天牌局不占用当天的新机会。
    const legacyToday = date === today ? existing : await readDoc(transaction.collection('table_venue_draws').doc(`${tableId}_${today}`))
    const dailyDraw = table.venueLastDraw?.date === today ? table.venueLastDraw
      : legacyToday && dayAt(legacyToday.drawnAt) === today
        ? { date: today, targetDate: today, drawnBy: legacyToday.drawnBy, drawnAt: legacyToday.drawnAt } : null
    const unavailableCode = date < today ? 'PAST_DATE' : date > maxDate ? 'FUTURE_DATE' : dailyDraw ? 'DAILY_LIMIT' : null
    const unavailableReason = unavailableCode === 'PAST_DATE' ? '过去的牌局日期只能查看已有结果，不能补抽'
      : unavailableCode === 'FUTURE_DATE' ? '最多可提前 30 天抽取牌局地点'
        : unavailableCode === 'DAILY_LIMIT' ? `今天已为 ${dailyDraw.targetDate} 的牌局抽过签，明天再来` : ''
    if (event.action === 'venueStatus') return { ok: true, date, today, maxDate, serverTime: now, config, draw: publicDraw(existing),
      dailyDraw, canDraw: !existing && !unavailableCode, unavailableReason: existing ? '' : unavailableReason }
    // 重试、历史查询和跨天查看均先返回原结果，不消耗新的每日机会。
    if (existing) return { ok: true, date, today, maxDate, serverTime: now, draw: publicDraw(existing) }
    if (unavailableCode) return fail(unavailableCode, unavailableReason)
    const candidates = config.venues.filter((v) => v.enabled).map(({ id, name }) => ({ id, name }))
    if (!candidates.length) return fail('NO_VENUES', '暂无启用的棋牌室，请联系管理员维护名单')
    const draw = { tableId, date, venue: candidates[randomInt(candidates.length)], candidates, configVersion: config.version,
      drawnBy: identity.playerName, drawnAt: now }
    await drawRef.set({ data: draw })
    await transaction.collection('match_tables').doc(tableId).update({ data: {
      venueLastDraw: { date: today, targetDate: date, drawnBy: identity.playerName, drawnAt: now },
    } })
    return { ok: true, date, today, maxDate, serverTime: now, draw: publicDraw(draw) }
  })
}
