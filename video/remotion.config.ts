import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Config } from '@remotion/cli/config'

// Use dedicated chrome-headless-shell to eliminate macOS full-Chrome GPU compositor
// 3x3 tile-glitches, paired with fast high-quality JPEG intermediate frames.
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(92)
Config.setOverwriteOutput(true)

const home = os.homedir()
const HEADLESS_SHELL_CANDIDATES = [
  path.join(home, 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-x64/chrome-headless-shell'),
  path.join(home, 'Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-x64/chrome-headless-shell'),
  path.join(home, '.cache/hyperframes/chrome/chrome-headless-shell'),
]

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

let configured = false
for (const executable of HEADLESS_SHELL_CANDIDATES) {
  if (fs.existsSync(executable)) {
    Config.setBrowserExecutable(executable)
    Config.setChromeMode('headless-shell')
    configured = true
    break
  }
}

if (!configured) {
  for (const executable of CHROME_CANDIDATES) {
    if (fs.existsSync(executable)) {
      Config.setBrowserExecutable(executable)
      break
    }
  }
}
