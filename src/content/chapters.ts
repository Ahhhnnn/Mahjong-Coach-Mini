export type Chapter = {
  id: string
  title: string
  desc: string
  /** 该章节包含的题目 ID */
  puzzles: string[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    title: '入门·牌效基础',
    desc: '学会处理孤张，保留有效搭子',
    puzzles: ['b01', 'b02', 'b03', 'b04', 'b05'],
  },
  {
    id: 'ch2',
    title: '进阶·中张判断',
    desc: '边张、嵌张、浮牌的精确取舍',
    puzzles: ['b06', 'b07', 'b08', 'b09', 'b10'],
  },
  {
    id: 'ch3',
    title: '碰牌后拆搭',
    desc: '副露后手牌变少，拆搭更需精准',
    puzzles: ['b11', 'b12', 'b13', 'b14', 'b15'],
  },
  {
    id: 'ch4',
    title: '复杂牌型决策',
    desc: '对子冲突、七对方向等高级判断',
    puzzles: ['b16', 'b17', 'b18', 'b19', 'b20'],
  },
  {
    id: 'ch5',
    title: '多副露残局',
    desc: '两组副露后的将牌与听牌判断',
    puzzles: ['b21', 'b22', 'b23', 'b24', 'b25'],
  },
]

/** 前 N 章自由进入，之后需完成上一章 */
export const FREE_CHAPTERS = 2
