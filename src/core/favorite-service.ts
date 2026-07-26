import Taro from '@tarojs/taro'

export type FavoriteItem = {
  puzzleId: string
  createdAt: number
}

const STORAGE_KEY = 'favorites'

function isUserLoggedIn(): boolean {
  try {
    const raw = Taro.getStorageSync('user_info')
    if (!raw) return false
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw
    return !!user?.openid
  } catch {
    return false
  }
}

function readLocal(): FavoriteItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((f: FavoriteItem) => f && f.puzzleId)
  } catch {
    return []
  }
}

function writeLocal(items: FavoriteItem[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, items)
  } catch {
    /* ignore */
  }
}

export function listFavorites(): FavoriteItem[] {
  return readLocal().sort((a, b) => b.createdAt - a.createdAt)
}

export function isFavorited(puzzleId: string): boolean {
  return readLocal().some((f) => f.puzzleId === puzzleId)
}

function syncSaveToCloud(item: FavoriteItem) {
  try {
    ;(Taro as any).cloud
      ?.callFunction({ name: 'saveFavorite', data: item })
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

function syncRemoveToCloud(puzzleId: string) {
  try {
    ;(Taro as any).cloud
      ?.callFunction({ name: 'removeFavorite', data: { puzzleId } })
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

/** 切换收藏状态，返回切换后是否已收藏 */
export function toggleFavorite(puzzleId: string): boolean {
  const list = readLocal()
  const idx = list.findIndex((f) => f.puzzleId === puzzleId)
  if (idx >= 0) {
    list.splice(idx, 1)
    writeLocal(list)
    if (isUserLoggedIn()) syncRemoveToCloud(puzzleId)
    return false
  }
  const item: FavoriteItem = { puzzleId, createdAt: Date.now() }
  list.unshift(item)
  writeLocal(list)
  if (isUserLoggedIn()) syncSaveToCloud(item)
  return true
}

export function removeFavorite(puzzleId: string) {
  const list = readLocal().filter((f) => f.puzzleId !== puzzleId)
  writeLocal(list)
  if (isUserLoggedIn()) syncRemoveToCloud(puzzleId)
}

function mergeFavorites(local: FavoriteItem[], cloud: FavoriteItem[]): FavoriteItem[] {
  const map = new Map<string, FavoriteItem>()
  for (const f of cloud) {
    if (f?.puzzleId) map.set(f.puzzleId, f)
  }
  for (const f of local) {
    if (!f?.puzzleId) continue
    const exist = map.get(f.puzzleId)
    if (!exist || f.createdAt >= exist.createdAt) {
      map.set(f.puzzleId, f)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
}

/** 登录后：拉取云端收藏并与本地合并 */
export async function syncCloudFavoritesToLocal(): Promise<number> {
  try {
    const res = await (Taro as any).cloud.callFunction({ name: 'getFavorites', data: {} })
    const cloud: FavoriteItem[] = res?.result?.favorites || []
    if (!Array.isArray(cloud)) return 0
    const local = readLocal()
    const merged = mergeFavorites(local, cloud)
    writeLocal(merged)
    return merged.length - local.length
  } catch {
    return 0
  }
}

/** 登录后：把本地收藏推到云端 */
export function pushLocalFavoritesToCloud() {
  try {
    listFavorites()
      .slice(0, 100)
      .forEach((f) => syncSaveToCloud(f))
  } catch {
    /* ignore */
  }
}
