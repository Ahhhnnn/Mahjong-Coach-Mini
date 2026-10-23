// 旧客户端不得继续读写按账号隔离的牌局。新版本统一使用 matchTable。
exports.main = async () => ({ ok: false, code: 'UPGRADE_REQUIRED', msg: '牌桌已升级，请更新小程序后重试' })
