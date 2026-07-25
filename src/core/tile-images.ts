import tileData from '../content/tile-data.json'

/** 麻将牌图片映射（base64 内联，真机加载稳定） */
const tileImageMap = tileData as Record<string, string>

export function getTileImage(tile: string): string {
  return tileImageMap[tile] || ''
}
