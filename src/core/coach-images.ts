import heheAvatar from '../assets/coach/hehe.jpg'
import duhanAvatar from '../assets/coach/duhan.jpg'

/** 教练头像映射（webpack 自动处理为 base64 或文件引用） */
const avatarMap: Record<string, string> = {
  hehe: heheAvatar,
  duhan: duhanAvatar,
}

export function getCoachAvatar(id: string): string {
  return avatarMap[id] || ''
}
