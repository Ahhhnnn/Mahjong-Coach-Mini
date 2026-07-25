import heheAvatar from '../assets/coach/hehe.jpg'
import duhanAvatar from '../assets/coach/duhan.jpg'
import zhouxxAvatar from '../assets/tiles/back.png' // TODO: 替换为周猩猩专属头像

/** 教练头像映射（webpack 自动处理为 base64 或文件引用） */
const avatarMap: Record<string, string> = {
  hehe: heheAvatar,
  duhan: duhanAvatar,
  zhouxx: zhouxxAvatar,
}

export function getCoachAvatar(id: string): string {
  return avatarMap[id] || ''
}
