import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Grid, Button } from '@taroify/core'
import {
  CalendarOutlined,
  Fire,
  Aim,
  Medal,
  Records,
  Checked,
  Arrow,
} from '@taroify/icons'

import RadarChart from '../../components/radar-chart'
import { fetchCloudRecords, mergeRecords, type TrainRecord } from '../../core/cloud'
import {
  computeReportStats,
  emptyReportStats,
  RADAR_LABELS,
  type ReportStats,
  type SkillStat,
} from '../../core/report-stats-service'
import { getCachedPuzzles, loadPuzzles } from '../../core/puzzle-service'
import { loadMistakes } from '../../core/mistake-service'

import headerBanner from '../../assets/home/header-banner.jpg'
import coachBanner from '../../assets/home/coach-banner.jpg'
import tipBanner from '../../assets/home/tip-banner.jpg'

import './index.scss'

const BRAND = '#1a5c2e'
const SKILL_PREVIEW = 6

function buildReport(records: TrainRecord[], mistakeCount: number): ReportStats {
  return computeReportStats(records, { mistakeCount })
}

export default function ReportPage() {
  const [report, setReport] = useState<ReportStats>(emptyReportStats)
  const [skillsExpanded, setSkillsExpanded] = useState(false)

  const refreshLocal = (records?: TrainRecord[]) => {
    let local: TrainRecord[] = records || []
    if (!records) {
      try {
        local = (Taro.getStorageSync('train_records') as TrainRecord[]) || []
      } catch {
        local = []
      }
    }
    const puzzles = getCachedPuzzles()
    const mistakeCount = loadMistakes(puzzles).filter((m) => m.status !== 'mastered').length
    setReport(buildReport(local, mistakeCount))
  }

  useDidShow(() => {
    refreshLocal()
    loadPuzzles().then(() => refreshLocal())

    let localRecords: TrainRecord[] = []
    try {
      localRecords = (Taro.getStorageSync('train_records') as TrainRecord[]) || []
    } catch {
      localRecords = []
    }

    fetchCloudRecords().then((cloudRecords) => {
      if (!cloudRecords || cloudRecords.length === 0) return
      const merged = mergeRecords(localRecords, cloudRecords)
      if (merged.length > localRecords.length) {
        try {
          Taro.setStorageSync('train_records', merged.slice(0, 500))
        } catch {
          /* ignore */
        }
        refreshLocal(merged)
      }
    })
  })

  const levelProgress = (report.base.levelXp / report.base.levelXpMax) * 100
  const hasRecords = report.base.total > 0
  const sampledSkills = report.skills.filter((s) => s.sampleCount > 0)
  const visibleSkills = skillsExpanded
    ? sampledSkills
    : sampledSkills.slice(0, SKILL_PREVIEW)
  const canExpandSkills = sampledSkills.length > SKILL_PREVIEW

  const goTrain = () => Taro.switchTab({ url: '/pages/puzzles/index' })
  const goMistakes = (chapterId?: string) => {
    const q = chapterId ? `?chapterId=${chapterId}` : ''
    Taro.navigateTo({ url: `/pages/mistakes/index${q}` })
  }

  const calendarPad = (() => {
    const first = report.calendarDays[0]
    if (!first) return 0
    const [y, m, d] = first.key.split('-').map(Number)
    return new Date(y, m - 1, d).getDay()
  })()

  return (
    <View className="report-page">
      {/* Hero：仅标题氛围，等级卡独立叠在下方 */}
      <View className="report-hero">
        <Image className="hero-banner" src={headerBanner} mode="aspectFill" />
        <View className="hero-mask" />
        <View className="hero-copy">
          <Text className="hero-title">成长报告</Text>
          <Text className="hero-sub">你的进步看得见</Text>
        </View>
      </View>

      <View className="level-card">
        <View className="level-badge">
          <Text className="level-badge-text">Lv.{report.base.level}</Text>
        </View>
        <View className="level-main">
          <Text className="level-title">{report.base.levelTitle}</Text>
          <View className="level-bar">
            <View className="level-fill" style={{ width: `${levelProgress}%` }} />
          </View>
          <Text className="level-meta">
            训练 {report.trainDaysTotal} 天 · 今日 {report.base.todayDone} 题 ·{' '}
            {report.base.levelXp}/{report.base.levelXpMax} 经验
          </Text>
        </View>
      </View>

      {!hasRecords ? (
        <View className="section-card empty-card">
          <Text className="empty-title">还没有训练记录</Text>
          <Text className="empty-desc">完成几道拆搭题后，这里会生成你的成长报告</Text>
          <Button className="empty-cta" color="primary" shape="round" onClick={goTrain}>
            去训练
          </Button>
        </View>
      ) : (
        <>
          {/* 本周表现 */}
          <View className="section-card week-card">
            <View className="section-head">
              <Text className="section-title">本周表现</Text>
            </View>
            <Grid className="week-grid" columns={4} bordered={false} centered>
              <Grid.Item
                icon={
                  <View className="stat-icon stat-icon-green">
                    <CalendarOutlined size={20} color={BRAND} />
                  </View>
                }
                text={
                  <View className="stat-text">
                    <Text className="stat-num">{report.weekDone}</Text>
                    <Text className="stat-label">训练题数</Text>
                  </View>
                }
              />
              <Grid.Item
                icon={
                  <View className="stat-icon stat-icon-gold">
                    <Medal size={20} color="#c9a227" />
                  </View>
                }
                text={
                  <View className="stat-text">
                    <Text className="stat-num">{report.weekAccuracy}%</Text>
                    <Text className="stat-label">正确率</Text>
                  </View>
                }
              />
              <Grid.Item
                icon={
                  <View className="stat-icon stat-icon-green">
                    <Aim size={20} color={BRAND} />
                  </View>
                }
                text={
                  <View className="stat-text">
                    <Text className="stat-num">{report.weekOptimalRate}%</Text>
                    <Text className="stat-label">最优率</Text>
                  </View>
                }
              />
              <Grid.Item
                icon={
                  <View className="stat-icon stat-icon-orange">
                    <Fire size={20} color="#e67e22" />
                  </View>
                }
                text={
                  <View className="stat-text">
                    <Text className="stat-num">{report.base.streak}天</Text>
                    <Text className="stat-label">连续训练</Text>
                  </View>
                }
              />
            </Grid>
          </View>

          {/* 能力雷达 */}
          <View className="section-card radar-card">
            <View className="section-head">
              <Text className="section-title">能力雷达</Text>
              <Text className="section-hint">根据作答动态评估</Text>
            </View>
            <View className="radar-wrap">
              <RadarChart values={report.radar} labels={RADAR_LABELS} size={280} />
            </View>
            <View className="radar-legend">
              {RADAR_LABELS.map((label, i) => (
                <View key={label} className="legend-item">
                  <Text className="legend-dot" />
                  <Text className="legend-label">{label}</Text>
                  <Text className="legend-value">{report.radar[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 能力成长 */}
          <View className="section-card skills-card">
            <View className="section-head">
              <Text className="section-title">能力成长</Text>
              <Text className="section-hint">本周章节正确率</Text>
            </View>
            {visibleSkills.length === 0 ? (
              <Text className="skills-empty">本周暂无分章节数据，多练几题后再来看</Text>
            ) : (
              <View className="skills-list">
                {visibleSkills.map((skill) => (
                  <SkillRow key={skill.chapterId} skill={skill} />
                ))}
              </View>
            )}
            {canExpandSkills && (
              <View
                className="skills-toggle"
                onClick={() => setSkillsExpanded((v) => !v)}
              >
                <Text className="skills-toggle-text">
                  {skillsExpanded ? '收起' : `查看全部 ${sampledSkills.length} 项`}
                </Text>
              </View>
            )}
          </View>

          {/* 薄弱项 */}
          <View className="focus-banner">
            <Image className="focus-bg" src={coachBanner} mode="aspectFill" />
            <View className="focus-mask" />
            <View className="focus-copy">
              <Text className="focus-eyebrow">本周焦点</Text>
              {report.weakest ? (
                <>
                  <Text className="focus-title">{report.weakest.title}</Text>
                  <Text className="focus-desc">
                    正确率 {report.weakest.accuracy}% · 建议专项巩固
                  </Text>
                </>
              ) : (
                <>
                  <Text className="focus-title">保持节奏继续练</Text>
                  <Text className="focus-desc">完成更多章节后，这里会指出薄弱点</Text>
                </>
              )}
              <Button
                className="focus-cta"
                size="mini"
                shape="round"
                color="primary"
                onClick={() =>
                  report.weakest && report.mistakeCount > 0
                    ? goMistakes(report.weakest.chapterId)
                    : goTrain()
                }
              >
                {report.weakest && report.mistakeCount > 0 ? '专项复习 ›' : '去训练 ›'}
              </Button>
            </View>
          </View>

          {/* 学习待办 */}
          <View className="section-card todo-card">
            <View className="section-head">
              <Text className="section-title">学习待办</Text>
            </View>
            <View className="todo-row" onClick={() => goMistakes()}>
              <View className="todo-left">
                <View className="todo-icon">
                  <Records size={22} color={BRAND} />
                </View>
                <View className="todo-copy">
                  <Text className="todo-name">错题待复习</Text>
                  <Text className="todo-meta">
                    {report.mistakeCount > 0
                      ? `${report.mistakeCount} 题待巩固`
                      : '暂无待复习错题'}
                  </Text>
                </View>
              </View>
              <Arrow size={18} color="#bbb" />
            </View>
            <View className="todo-row" onClick={goTrain}>
              <View className="todo-left">
                <View className="todo-icon">
                  <Checked size={22} color={BRAND} />
                </View>
                <View className="todo-copy">
                  <Text className="todo-name">基础拆搭进度</Text>
                  <Text className="todo-meta">
                    已完成 {report.chapterProgress.completedChapters}/
                    {report.chapterProgress.totalChapters} 章 ·{' '}
                    {report.chapterProgress.donePuzzles}/
                    {report.chapterProgress.totalPuzzles} 题
                  </Text>
                </View>
              </View>
              <View className="todo-progress-wrap">
                <View className="todo-progress">
                  <View
                    className="todo-progress-fill"
                    style={{ width: `${report.chapterProgress.percent}%` }}
                  />
                </View>
                <Text className="todo-percent">{report.chapterProgress.percent}%</Text>
              </View>
            </View>
          </View>

          {/* 训练日历 */}
          <View className="section-card calendar-card">
            <View className="section-head">
              <Text className="section-title">训练日历</Text>
              <Text className="section-hint">最长连续 {report.maxStreak} 天</Text>
            </View>
            <View className="cal-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
                <Text key={w} className="cal-wd">
                  {w}
                </Text>
              ))}
            </View>
            <View className="cal-grid">
              {Array.from({ length: calendarPad }).map((_, i) => (
                <View key={`pad-${i}`} className="cal-cell cal-pad" />
              ))}
              {report.calendarDays.map((day) => (
                <View key={day.key} className="cal-cell">
                  <View
                    className={`cal-dot ${day.trained ? 'trained' : ''} ${
                      day.isToday ? 'today' : ''
                    }`}
                  >
                    <Text className="cal-day-num">{day.label}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View className="cal-legend">
              <View className="cal-legend-item">
                <View className="cal-legend-dot trained" />
                <Text className="cal-legend-text">已训练</Text>
              </View>
              <View className="cal-legend-item">
                <View className="cal-legend-dot" />
                <Text className="cal-legend-text">未训练</Text>
              </View>
            </View>
          </View>
        </>
      )}

      <View className="tip-banner">
        <Image className="tip-img" src={tipBanner} mode="widthFix" />
      </View>
    </View>
  )
}

function SkillRow({ skill }: { skill: SkillStat }) {
  const score = skill.score ?? 0
  return (
    <View className="skill-row">
      <View className="skill-tag">
        <Text className="skill-tag-text">{skill.shortLabel}</Text>
      </View>
      <View className="skill-body">
        <Text className="skill-name">{skill.title}</Text>
        <View className="skill-bar">
          <View className="skill-fill" style={{ width: `${score}%` }} />
        </View>
      </View>
      <View className="skill-right">
        <Text className="skill-score">{skill.score === null ? '—' : skill.score}</Text>
        {skill.delta !== null && skill.delta !== 0 && (
          <Text className={`skill-delta ${skill.delta > 0 ? 'up' : 'down'}`}>
            {skill.delta > 0 ? '↑' : '↓'} {Math.abs(skill.delta)}
          </Text>
        )}
        {skill.delta === 0 && <Text className="skill-delta flat">—</Text>}
      </View>
    </View>
  )
}
