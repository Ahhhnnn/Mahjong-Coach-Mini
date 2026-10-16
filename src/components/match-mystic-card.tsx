import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Arrow } from '@taroify/icons'
import { formatMysticRate, formatMysticScore, MYSTIC_MIN_GAMES, type MatchMystic } from '../core/match-mystic-service'
import './match-mystic-card.scss'

export default function MatchMysticCard({ stats }: { stats: MatchMystic }) {
  const rival = stats.opponents.find((entry) => stats.nemeses.includes(entry.name))
  const place = stats.locations.find((entry) => stats.luckyPlaces.includes(entry.name))
  return (
    <View className="mystic-preview" onClick={() => Taro.navigateTo({ url: '/pages/mystic/index' })}
      role="button" aria-label="查看我的玄学档案">
      <View className="mystic-preview-head">
        <Text className="mystic-preview-title">牌桌玄学</Text>
        <Text className="mystic-preview-scope">全部历史 · {stats.games} 场</Text>
      </View>
      <Text className="mystic-preview-motto">冤家有路，福地有门</Text>
      <View className="mystic-preview-row">
        <Text className="mystic-preview-seal">冤家</Text>
        <View className="mystic-preview-copy">
          <Text className="mystic-preview-name">{stats.nemeses.join('、') || (stats.games < MYSTIC_MIN_GAMES ? '冤家还在观察中' : '暂无明显克星')}</Text>
          <Text className="mystic-preview-note">{rival ? `${rival.ahead} / ${rival.games} 场积分高于我 · ${formatMysticRate(rival.pressureRate)}` : '同场积分见高低，五场之后再下定论'}</Text>
        </View>
      </View>
      <View className="mystic-preview-row">
        <Text className="mystic-preview-seal lucky">福地</Text>
        <View className="mystic-preview-copy">
          <Text className="mystic-preview-name">{stats.luckyPlaces.join('、') || '福地尚待发现'}</Text>
          <Text className="mystic-preview-note">{place ? `${place.games} 场 · 场均 ${formatMysticScore(place.average)}` : '多记几场，看看哪里更顺手'}</Text>
        </View>
      </View>
      <View className="mystic-preview-footer"><Text>查看我的玄学档案</Text><Arrow size={14} /></View>
    </View>
  )
}
