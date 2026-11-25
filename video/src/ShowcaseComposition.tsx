import React from 'react'
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { SubtitleBar } from './components/SubtitleBar'
import { Scene1Intro } from './scenes/Scene1Intro'
import { Scene2DiscardTrain } from './scenes/Scene2DiscardTrain'
import { Scene3CoachAndRadar } from './scenes/Scene3CoachAndRadar'
import { Scene4RecordsAndBadges } from './scenes/Scene4RecordsAndBadges'
import {
  Scene5MysticAndVenue,
  VENUE_STAMP_LOCAL_FRAME,
  VENUE_TICK_LOCAL_FRAMES,
} from './scenes/Scene5MysticAndVenue'
import { Scene6Outro } from './scenes/Scene6Outro'

export const TRANSITION_FRAMES = 18

export const SCENE_DURATIONS = {
  s1: 360,
  s2: 558,
  s3: 558,
  s4: 618,
  s5: 678,
  s6: 438,
} as const

// Effective global start frames accounting for 18-frame transition overlaps
export const SCENE_STARTS = {
  s1: 0,
  s2: SCENE_DURATIONS.s1 - TRANSITION_FRAMES, // 342
  s3: SCENE_DURATIONS.s1 + SCENE_DURATIONS.s2 - 2 * TRANSITION_FRAMES, // 882
  s4: SCENE_DURATIONS.s1 + SCENE_DURATIONS.s2 + SCENE_DURATIONS.s3 - 3 * TRANSITION_FRAMES, // 1422
  s5:
    SCENE_DURATIONS.s1 +
    SCENE_DURATIONS.s2 +
    SCENE_DURATIONS.s3 +
    SCENE_DURATIONS.s4 -
    4 * TRANSITION_FRAMES, // 2022
  s6:
    SCENE_DURATIONS.s1 +
    SCENE_DURATIONS.s2 +
    SCENE_DURATIONS.s3 +
    SCENE_DURATIONS.s4 +
    SCENE_DURATIONS.s5 -
    5 * TRANSITION_FRAMES, // 2682
} as const

export const TOTAL_DURATION =
  SCENE_DURATIONS.s1 +
  SCENE_DURATIONS.s2 +
  SCENE_DURATIONS.s3 +
  SCENE_DURATIONS.s4 +
  SCENE_DURATIONS.s5 +
  SCENE_DURATIONS.s6 -
  5 * TRANSITION_FRAMES // 3120 frames = 52.0s @ 60fps

export const ShowcaseComposition: React.FC = () => {
  const { durationInFrames } = useVideoConfig()

  const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES })

  return (
    <AbsoluteFill style={{ backgroundColor: '#071c0e' }}>
      {/* Main Background Music Track with gentle end fade */}
      <Audio
        src={staticFile('audio/bgm.wav')}
        volume={(f) =>
          interpolate(f, [0, 36, durationInFrames - 150, durationInFrames], [0, 0.52, 0.52, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />

      {/* Scene 1 SFX */}
      <Sequence from={8} durationInFrames={90}>
        <Audio src={staticFile('audio/sfx-shuffle.wav')} volume={0.68} />
      </Sequence>
      <Sequence from={126} durationInFrames={36}>
        <Audio src={staticFile('audio/sfx-stamp.wav')} volume={0.62} />
      </Sequence>

      {/* Transition 1 -> 2 */}
      <Sequence from={SCENE_STARTS.s2} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx-whoosh.wav')} volume={0.42} />
      </Sequence>

      {/* Scene 2 SFX: Discard + Analysis Pop */}
      <Sequence from={SCENE_STARTS.s2 + 175} durationInFrames={28}>
        <Audio src={staticFile('audio/sfx-discard.wav')} volume={0.82} />
      </Sequence>
      <Sequence from={SCENE_STARTS.s2 + 200} durationInFrames={28}>
        <Audio src={staticFile('audio/sfx-pop.wav')} volume={0.5} />
      </Sequence>

      {/* Transition 2 -> 3 */}
      <Sequence from={SCENE_STARTS.s3} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx-whoosh.wav')} volume={0.42} />
      </Sequence>

      {/* Scene 3 SFX: Chat Bubbles & Persona Switch */}
      <Sequence from={SCENE_STARTS.s3 + 28} durationInFrames={28}>
        <Audio src={staticFile('audio/sfx-pop.wav')} volume={0.48} />
      </Sequence>
      <Sequence from={SCENE_STARTS.s3 + 266} durationInFrames={28}>
        <Audio src={staticFile('audio/sfx-pop.wav')} volume={0.58} />
      </Sequence>

      {/* Transition 3 -> 4 */}
      <Sequence from={SCENE_STARTS.s4} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx-whoosh.wav')} volume={0.42} />
      </Sequence>

      {/* Scene 4 SFX: Badge Pop + Legendary Unlock Fanfare */}
      <Sequence from={SCENE_STARTS.s4 + 235} durationInFrames={28}>
        <Audio src={staticFile('audio/sfx-pop.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={SCENE_STARTS.s4 + 455} durationInFrames={80}>
        <Audio src={staticFile('audio/sfx-badge.wav')} volume={0.78} />
      </Sequence>

      {/* Transition 4 -> 5 (Paper Scroll Unveil) */}
      <Sequence from={SCENE_STARTS.s5} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx-whoosh.wav')} volume={0.48} />
      </Sequence>

      {/* Scene 5 SFX: Mystic Stamp + Decelerating Venue Lottery Ticks + Final Stamp */}
      <Sequence from={SCENE_STARTS.s5 + 56} durationInFrames={36}>
        <Audio src={staticFile('audio/sfx-stamp.wav')} volume={0.56} />
      </Sequence>
      {VENUE_TICK_LOCAL_FRAMES.map((localF, idx) => (
        <Sequence key={localF} from={SCENE_STARTS.s5 + localF} durationInFrames={10}>
          <Audio
            src={staticFile('audio/sfx-tick.wav')}
            volume={idx === VENUE_TICK_LOCAL_FRAMES.length - 1 ? 0.72 : 0.45 + idx * 0.012}
          />
        </Sequence>
      ))}
      <Sequence from={SCENE_STARTS.s5 + VENUE_STAMP_LOCAL_FRAME} durationInFrames={36}>
        <Audio src={staticFile('audio/sfx-stamp.wav')} volume={0.85} />
      </Sequence>

      {/* Transition 5 -> 6 */}
      <Sequence from={SCENE_STARTS.s6} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx-whoosh.wav')} volume={0.45} />
      </Sequence>

      {/* Scene 6 SFX: Finale Stamp */}
      <Sequence from={SCENE_STARTS.s6 + 124} durationInFrames={36}>
        <Audio src={staticFile('audio/sfx-stamp.wav')} volume={0.62} />
      </Sequence>

      {/* 6 Visual Scenes via TransitionSeries */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s1}>
          <Scene1Intro />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s2}>
          <Scene2DiscardTrain />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s3}>
          <Scene3CoachAndRadar />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s4}>
          <Scene4RecordsAndBadges />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={wipe({ direction: 'from-left' })} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s5}>
          <Scene5MysticAndVenue />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s6}>
          <Scene6Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Persistent Synchronized Bottom Subtitle Bar */}
      <SubtitleBar />
    </AbsoluteFill>
  )
}
