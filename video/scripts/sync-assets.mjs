import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const videoRoot = path.resolve(__dirname, '..')
const srcAssets = path.resolve(videoRoot, '../src/assets')
const destAssets = path.resolve(videoRoot, 'public/assets')

const FOLDERS_TO_SYNC = ['tiles', 'coach', 'mascot', 'home', 'icons']

fs.mkdirSync(destAssets, { recursive: true })

let copied = 0
for (const folder of FOLDERS_TO_SYNC) {
  const fromDir = path.join(srcAssets, folder)
  const toDir = path.join(destAssets, folder)
  if (!fs.existsSync(fromDir)) {
    console.warn(`[sync-assets] skip missing folder: ${fromDir}`)
    continue
  }
  fs.mkdirSync(toDir, { recursive: true })
  for (const entry of fs.readdirSync(fromDir)) {
    if (entry.startsWith('.')) continue
    const fromFile = path.join(fromDir, entry)
    const toFile = path.join(toDir, entry)
    if (fs.statSync(fromFile).isFile()) {
      fs.copyFileSync(fromFile, toFile)
      copied++
    }
  }
}

console.log(`[sync-assets] synced ${copied} asset files to ${destAssets}`)
