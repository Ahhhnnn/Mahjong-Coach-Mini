import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@taroify/core'
import './index.scss'
export default function TableIdentityGate() {
  return <View className="identity-gate">
    <Text className="identity-gate-seal">四人牌桌</Text>
    <Text className="identity-gate-title">先入座，再看你的牌程</Text>
    <Text className="identity-gate-note">认领自己的身份，战绩、荣誉和玄学命簿就会与你相连。</Text>
    <Button color="primary" shape="round" onClick={() => Taro.navigateTo({ url: '/pages/identity/index' })}>认领我的身份</Button>
  </View>
}
