import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const videoRoot = path.resolve(__dirname, '..')
const stillsDir = path.join(videoRoot, 'out', 'stills')
const bundleDir = path.join(videoRoot, 'out', 'bundle')
fs.mkdirSync(stillsDir, { recursive: true })

// Representative climax frame for each of the 6 scenes
const KEYFRAMES = [
  { name: 'scene1-intro.png', frame: 240 },
  { name: 'scene2-discard.png', frame: 740 },
  { name: 'scene3-coach-radar.png', frame: 1320 },
  { name: 'scene4-records-badges.png', frame: 1920 },
  { name: 'scene5-mystic-venue.png', frame: 2540 },
  { name: 'scene6-outro.png', frame: 2920 },
]

const remotionBin = path.join(videoRoot, 'node_modules', '.bin', 'remotion')

console.log('[stills] bundling once for fast multi-still rendering...')
execFileSync(remotionBin, ['bundle', 'src/index.ts', '--out-dir', bundleDir], {
  cwd: videoRoot,
  stdio: ['ignore', 'inherit', 'inherit'],
})

for (const kf of KEYFRAMES) {
  const outPath = path.join(stillsDir, kf.name)
  console.log(`[stills] rendering ${kf.name} @ frame ${kf.frame}...`)
  execFileSync(
    remotionBin,
    ['still', bundleDir, 'MahjongCoachShowcase', outPath, `--frame=${kf.frame}`],
    { cwd: videoRoot, stdio: 'inherit' },
  )
}

console.log(`[stills] rendered ${KEYFRAMES.length} stills to ${stillsDir}`)
