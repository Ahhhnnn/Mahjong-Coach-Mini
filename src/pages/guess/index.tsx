import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { getTileImage } from '../../core/tile-images'
import { tileLabel } from '../../core/tiles'

import './index.scss'

const QUESTIONS = [
  {
    id: 'g01',
    desc: '对手定缺万，河牌已打出 1万、9万、3万。最近摸牌后打出了一张 5筒，表情犹豫。他可能听什么？',
    options: ['3万', '8条', '6筒', '9筒'],
    answer: '8条',
    analysis: '从出牌记录看，对手万子已全部打出（定缺万），说明手牌集中在筒、条两门。5筒犹豫后打出，暗示筒子搭子已成型，剩余搭子大概率在条子。结合河牌中条子只出现过1-2张边张，8条作为中张搭子的进张最合理。',
    clues: ['定缺万 → 手牌只有筒、条', '5筒犹豫打出 → 筒子已成型', '条子河牌稀少 → 条子搭子可能性高'],
    waits: ['7条', '8条', '9条'],
  },
  {
    id: 'g02',
    desc: '对家定缺筒，连续打出 2筒、7筒。第8巡突然打出一张生张 4条，且之前从未打过条子中张。他可能听什么？',
    options: ['4条', '6万', '5筒', '2条'],
    answer: '6万',
    analysis: '对家定缺筒后快速清完筒子，说明在抢速度。第8巡打出从未出现过的生张4条，这是典型的"拆搭冲听"信号——为了听牌不惜打出危险牌。4条是条子中间张，打出它意味着条子已有完整面子，听口大概率在万子。6万是万子中最常见的双面听口。',
    clues: ['快速清筒 → 抢听牌速度', '生张4条 → 拆搭冲听信号', '条子已有面子 → 听口在万子'],
    waits: ['5万', '6万', '8万'],
  },
]

export default function GuessPage() {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const q = QUESTIONS[qIndex]

  const handleSubmit = () => {
    if (!selected) {
      Taro.showToast({ title: '请先选择一个选项', icon: 'none' })
      return
    }
    setSubmitted(true)
  }

  const nextQuestion = () => {
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1)
      setSelected(null)
      setSubmitted(false)
    } else {
      Taro.showToast({ title: '本组练习完成！', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }

  const isCorrect = selected === q.answer

  return (
    <View className="guess-page">
      <View className="guess-header">
        <Text className="guess-title">猜对手听牌</Text>
        <Text className="guess-sub">训练猜牌能力，洞察对手 · 第{qIndex + 1}/{QUESTIONS.length}题</Text>
      </View>

      {/* 题目描述 */}
      <View className="card question-card">
        <Text className="question-text">{q.desc}</Text>
      </View>

      {/* 选项区域 */}
      {!submitted && (
        <View className="card options-card">
          <Text className="options-title">你的选择：他可能听什么？</Text>
          <View className="options-grid">
            {q.options.map((opt) => (
              <View
                key={opt}
                className={`option-item ${selected === opt ? 'selected' : ''}`}
                onClick={() => setSelected(opt)}
              >
                <Text className="option-text">听{opt}</Text>
              </View>
            ))}
          </View>
          <View className={`btn-submit ${selected ? 'active' : ''}`} onClick={handleSubmit}>
            <Text className="btn-submit-text">提交选择</Text>
          </View>
        </View>
      )}

      {/* AI 分析结果 */}
      {submitted && (
        <View className="card result-card">
          <View className={`result-banner ${isCorrect ? 'correct' : 'wrong'}`}>
            <Text className="result-banner-text">
              {isCorrect ? '判断正确！+20分' : '判断有误，再接再厉'}
            </Text>
          </View>

          <Text className="analysis-title">AI 分析</Text>
          <Text className="analysis-text">{q.analysis}</Text>

          <View className="clues-box">
            <Text className="clues-title">关键线索</Text>
            {q.clues.map((c, i) => (
              <Text key={i} className="clue-line">· {c}</Text>
            ))}
          </View>

          <View className="waits-row">
            <Text className="waits-label">对手可能听的牌：</Text>
            {q.waits.map((w) => (
              <Image key={w} className="wait-tile" src={getTileImage(w.replace('条', 's').replace('万', 'm').replace('筒', 'p') as any)} mode="aspectFit" />
            ))}
          </View>

          <View className="btn-next" onClick={nextQuestion}>
            <Text className="btn-next-text">继续下一题</Text>
          </View>
        </View>
      )}
    </View>
  )
}
