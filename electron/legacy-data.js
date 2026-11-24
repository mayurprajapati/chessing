const fs = require('fs')
const path = require('path')

// Chessing was previously published as Chessist, which kept its data in a
// different folder. On first start, copy the saved settings and the downloaded
// Stockfish so the rename does not reset settings or download Stockfish again.
// These are the only places the old name is still used.
const LEGACY_DIR_NAME = 'Chessist'
const COPIES = [
  ['chessist-settings.json', 'chessing-settings.json'],
  ['stockfish.exe', 'stockfish.exe'],
]

function migrateLegacyUserData(appDataDir, userDataDir) {
  const legacyDir = path.join(appDataDir, LEGACY_DIR_NAME)
  // Windows paths are case-insensitive: a dev build named "chessist" could
  // already be using the legacy folder.
  if (path.resolve(legacyDir).toLowerCase() === path.resolve(userDataDir).toLowerCase()) return []

  const copied = []
  for (const [from, to] of COPIES) {
    const source = path.join(legacyDir, from)
    const target = path.join(userDataDir, to)
    try {
      if (!fs.existsSync(source) || fs.existsSync(target)) continue
      fs.mkdirSync(userDataDir, { recursive: true })
      fs.copyFileSync(source, target)
      copied.push(to)
    } catch {
      // A missing copy only costs a default setting or a fresh download.
    }
  }
  return copied
}

module.exports = { migrateLegacyUserData }
