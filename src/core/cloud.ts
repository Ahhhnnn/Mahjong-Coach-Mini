import Taro from '@tarojs/taro'

/**
 * 微信云开发环境 ID
 * 在微信开发者工具点击「云开发」按钮创建环境后，把环境 ID 填到这里。
 * 未配置时所有云端调用会静默失败，小程序仍可完全离线使用。
 */
export const CLOUD_ENV = 'cloud1-1gjvozwi57c18c42'

let inited = false

/** 初始化云环境（在 App 启动时调用一次） */
export function initCloud() {
  if (inited) return
  try {
    const cloud = (Taro as any).cloud
    if (!cloud) return
    cloud.init({ env: CLOUD_ENV, traceUser: true })
    inited = true
  } catch {
    /* ignore */
  }
}

/** 训练记录结构（本地与云端一致） */
export interface TrainRecord {
  id: string
  puzzleId: string
  tile: string
  hit: boolean
  reasonable: boolean
  time: number
}

/** 生成唯一记录 ID（用于本地/云端去重） */
export function makeRecordId(puzzleId: string): string {
  return `${Date.now()}_${puzzleId}_${Math.random().toString(36).slice(2, 8)}`
}

/** 后台同步单条记录到云端（fire-and-forget，失败静默，不阻塞 UI） */
export function syncRecordToCloud(record: TrainRecord) {
  if (!inited) return
  try {
    ;(Taro as any).cloud
      .callFunction({ name: 'saveRecord', data: record })
      .catch(() => {
        /* 离线/未配置时静默失败，本地数据不受影响 */
      })
  } catch {
    /* ignore */
  }
}

/** 从云端拉取当前用户全部记录（用于换设备恢复），失败返回 null */
export async function fetchCloudRecords(): Promise<TrainRecord[] | null> {
  if (!inited) return null
  try {
    const res = await (Taro as any).cloud.callFunction({
      name: 'getRecords',
      data: {},
    })
    return (res?.result?.records as TrainRecord[]) ?? null
  } catch {
    return null
  }
}

/**
 * 合并本地与云端记录，按 id 去重，按时间倒序返回。
 * 本地记录优先（同 id 时以本地为准）。
 */
export function mergeRecords(
  local: TrainRecord[],
  cloud: TrainRecord[]
): TrainRecord[] {
  const map = new Map<string, TrainRecord>()
  for (const r of cloud) {
    if (r && r.id) map.set(r.id, r)
  }
  for (const r of local) {
    const key = r.id || `${r.time}_${r.puzzleId}`
    map.set(key, r)
  }
  return Array.from(map.values()).sort((a, b) => b.time - a.time)
}
