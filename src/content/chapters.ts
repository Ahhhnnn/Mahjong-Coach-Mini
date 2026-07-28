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
    title: '对子定将与拆搭',
    desc: '一对定将、两对慎拆；用五搭和进张检验口诀',
    puzzles: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'],
  },
  {
    id: 'ch2',
    title: '五搭整理入门',
    desc: '搭多于五就拆弱搭，少于五就打低效孤张',
    puzzles: ['p07', 'p08', 'p09', 'p10', 'p11', 'p12'],
  },
  {
    id: 'ch3',
    title: '口诀真假鉴别',
    desc: '金三银七、边肚、夹张：分情况算，不硬套',
    puzzles: ['p13', 'p14', 'p15', 'p16', 'p17', 'p18'],
  },
  {
    id: 'ch4',
    title: '长连与冗余张',
    desc: '连续形里找出真正多余的那张',
    puzzles: ['p19', 'p20', 'p21', 'p22', 'p23', 'p24'],
  },
  {
    id: 'ch5',
    title: '单碰后的牌效',
    desc: '副露后手牌更紧，仍要比进张与五搭',
    puzzles: ['p25', 'p26', 'p27', 'p28', 'p29', 'p30', 'p31'],
  },
  {
    id: 'ch6',
    title: '高压门清',
    desc: '1～2 向听纠缠时，口诀让位给进张',
    puzzles: ['p32', 'p33', 'p34', 'p35', 'p36', 'p37', 'p38'],
  },
  {
    id: 'ch7',
    title: '双碰残局',
    desc: '两组副露后比较听口宽度与将位',
    puzzles: ['p39', 'p40', 'p41', 'p42', 'p43', 'p44'],
  },
  {
    id: 'ch8',
    title: '综合收官',
    desc: '等价最优、陷阱次优与听牌整理混练',
    puzzles: [
      'p45',
      'p46',
      'p47',
      'p48',
      'p49',
      'p50',
      'cd01',
      'cd02',
      'cd03',
      'cd04',
      'cd05',
      'cd06',
      'cd07',
      'cd08',
      'cd09',
      'cd10',
      'cd11',
    ],
  },
]

/** 前 N 章自由进入，之后需完成上一章 */
export const FREE_CHAPTERS = 2
