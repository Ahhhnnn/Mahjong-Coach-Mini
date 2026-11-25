import React from 'react'
import { Composition } from 'remotion'
import { ShowcaseComposition, TOTAL_DURATION } from './ShowcaseComposition'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MahjongCoachShowcase"
      component={ShowcaseComposition}
      durationInFrames={TOTAL_DURATION}
      fps={60}
      width={1920}
      height={1080}
    />
  )
}
