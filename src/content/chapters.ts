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
    title: '入门·孤张与两面',
    desc: '学会处理孤张，保留有效搭子',
    puzzles: ['b01', 'b02', 'b03', 'b04', 'b05'],
  },
  {
    id: 'ch2',
    title: '进阶·中张与边张',
    desc: '边张、嵌张、浮牌的精确取舍',
    puzzles: ['b06', 'b07', 'b08', 'b09', 'b10'],
  },
  {
    id: 'ch3',
    title: '单副露入门',
    desc: '碰牌后门牌变少，拆搭更需精准',
    puzzles: ['b11', 'b12', 'b13', 'b14', 'b15'],
  },
  {
    id: 'ch4',
    title: '复杂门清',
    desc: '对子冲突、重复张与多面连接',
    puzzles: ['b16', 'b17', 'b18', 'b19', 'b20'],
  },
  {
    id: 'ch5',
    title: '单副露巩固',
    desc: '副露后听牌整理与搭子冲突',
    puzzles: ['b21', 'b22', 'b23', 'b24', 'b25'],
  },
  {
    id: 'ch6',
    title: '单副露进阶·搭子取舍',
    desc: '重复张、高进张浮牌与听牌边张',
    puzzles: ['b26', 'b27', 'b28', 'b29', 'b30'],
  },
  {
    id: 'ch7',
    title: '多面冲突与等价切',
    desc: '听牌整理、长连多余张与最弱浮牌',
    puzzles: ['b31', 'b32', 'b33', 'b34', 'b35'],
  },
  {
    id: 'ch8',
    title: '高压门清·浮牌与重复张',
    desc: '复杂 1～2 向听的经典拆搭',
    puzzles: ['b36', 'b37', 'b38', 'b39', 'b40'],
  },
  {
    id: 'ch9',
    title: '双副露残局',
    desc: '嵌张将牌、拆顺做将与两面收官',
    puzzles: ['b41', 'b42', 'b43', 'b44', 'b45'],
  },
  {
    id: 'ch10',
    title: '综合经典难题',
    desc: '长连可拆点与多组等价最优切',
    puzzles: ['b46', 'b47', 'b48', 'b49', 'b50'],
  },
]

/** 前 N 章自由进入，之后需完成上一章 */
export const FREE_CHAPTERS = 2
