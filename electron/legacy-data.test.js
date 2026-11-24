import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { migrateLegacyUserData } from './legacy-data'

const roots = []
function appData() {
  const root = mkdtempSync(join(tmpdir(), 'chessing-legacy-'))
  roots.push(root)
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('copies settings and Stockfish from the Chessist folder on first start', () => {
  const root = appData()
  mkdirSync(join(root, 'Chessist'))
  writeFileSync(join(root, 'Chessist', 'chessist-settings.json'), '{"game":{"depth":21}}')
  writeFileSync(join(root, 'Chessist', 'stockfish.exe'), 'engine')

  const copied = migrateLegacyUserData(root, join(root, 'Chessing'))

  expect(copied).toEqual(['chessing-settings.json', 'stockfish.exe'])
  expect(readFileSync(join(root, 'Chessing', 'chessing-settings.json'), 'utf8')).toBe('{"game":{"depth":21}}')
  expect(readFileSync(join(root, 'Chessing', 'stockfish.exe'), 'utf8')).toBe('engine')
})

it('never overwrites settings Chessing already saved', () => {
  const root = appData()
  mkdirSync(join(root, 'Chessist'))
  mkdirSync(join(root, 'Chessing'))
  writeFileSync(join(root, 'Chessist', 'chessist-settings.json'), 'old')
  writeFileSync(join(root, 'Chessing', 'chessing-settings.json'), 'new')

  expect(migrateLegacyUserData(root, join(root, 'Chessing'))).toEqual([])
  expect(readFileSync(join(root, 'Chessing', 'chessing-settings.json'), 'utf8')).toBe('new')
})

it('does nothing without a Chessist folder', () => {
  const root = appData()
  expect(migrateLegacyUserData(root, join(root, 'Chessing'))).toEqual([])
  expect(existsSync(join(root, 'Chessing'))).toBe(false)
})
