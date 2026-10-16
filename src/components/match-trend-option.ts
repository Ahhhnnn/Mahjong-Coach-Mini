import { graphic, type EChartsCoreOption } from './chart-engine'
import type { MatchTrend } from '../core/match-stats-service'
import type { SettleUnit } from '../core/match-types'

export function trendOption(trend: MatchTrend, unit: SettleUnit): EChartsCoreOption {
  const suffix = unit === 'score' ? '分' : '元'
  return {
    backgroundColor: 'transparent',
    animationDuration: 900,
    animationDurationUpdate: 400,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: 'sans-serif', color: '#9cb9ac' },
    grid: { top: 56, right: 20, bottom: 30, left: 44, containLabel: false },
    legend: {
      top: 4, left: 0, itemWidth: 14, itemHeight: 7, icon: 'roundRect',
      textStyle: { color: '#c4d8ce', fontSize: 11 }, inactiveColor: '#4d665b',
      data: trend.series.map((s) => s.name),
    },
    tooltip: {
      trigger: 'axis', renderMode: 'richText', confine: true,
      backgroundColor: '#143b2b', borderColor: '#5b7355', borderWidth: 1,
      textStyle: { color: '#f4e7c8', fontSize: 11 },
      axisPointer: { type: 'line', lineStyle: { color: '#d8bc78', type: 'dashed' } },
      formatter: (raw: any) => {
        const items = Array.isArray(raw) ? raw : [raw]
        const index = items[0]?.dataIndex || 0
        const point = trend.points[index]
        const date = new Date(point?.time || 0)
        const title = index === 0 ? '累计起点' : `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        return [title, ...items.map((item: any) => `${item.seriesName}  ${item.value > 0 ? '+' : ''}${item.value} ${suffix}`)].join('\n')
      },
    },
    xAxis: {
      type: 'category', boundaryGap: false, data: trend.points.map((p) => p.label),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#829f91', fontSize: 10, hideOverlap: true, margin: 14 },
    },
    yAxis: {
      type: 'value', splitNumber: 4, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#829f91', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(180,211,193,0.10)', type: 'dashed' } },
    },
    series: trend.series.map((s, index) => ({
      id: s.id, name: s.name, type: 'line', smooth: 0.25, smoothMonotone: 'x',
      data: s.values, showSymbol: false, symbol: 'circle', symbolSize: 7,
      animationDelay: index * 90,
      lineStyle: { width: s.id === '__self__' ? 3 : 2, color: s.color },
      itemStyle: { color: s.color, borderColor: '#fff3d9', borderWidth: 1 },
      areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: `${s.color}24` }, { offset: 1, color: `${s.color}00` },
      ]) },
      emphasis: { focus: 'series', lineStyle: { width: 4 } },
      ...(index === 0 ? { markLine: {
        silent: true, symbol: 'none', label: { show: false },
        lineStyle: { color: '#bdad78', opacity: 0.4, type: 'dashed' }, data: [{ yAxis: 0 }],
      } } : {}),
    })),
  }
}
