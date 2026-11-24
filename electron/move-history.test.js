import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../extension/src/content/move-history.js', import.meta.url), 'utf8')
const context = {}
runInNewContext(source, context)
const history = context.ChessingMoveHistory

describe('castling rights from the move list', () => {
  it('keeps every right the board allows when nothing relevant moved', () => {
    expect(history.castlingRights('KQkq', ['e4', 'e5', 'Nf3', 'Nc6'])).toBe('KQkq')
  })

  it('removes both rights after a king walks away and back', () => {
    // King and rooks stand on their home squares again, so the board says KQ.
    expect(history.castlingRights('KQkq', ['e4', 'e5', 'Ke2', 'Nc6', 'Ke1', 'Nf6'])).toBe('kq')
  })

  it('removes the castling side after O-O and O-O-O, including 0-0 spelling', () => {
    expect(history.castlingRights('KQkq', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'])).toBe('kq')
    expect(history.castlingRights('KQkq', ['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'e3', '0-0-0+'])).toBe('KQ')
  })

  it('removes a rook right after the rook leaves and returns to its square', () => {
    expect(history.castlingRights('KQkq', ['h4', 'h5', 'Rh3', 'a5', 'Rh1', 'Ra6', 'a3', 'Ra8'])).toBe('Qk')
  })

  it('removes a rook right when that rook is captured on its square', () => {
    // A bishop captures on h8; even if a rook later reaches h8 the right is gone.
    expect(history.castlingRights('KQkq', ['b3', 'g6', 'Bb2', 'Bg7', 'Bxg7', 'Nf6', 'Bxh8'])).toBe('KQq')
  })

  it('reads figurine notation, check marks and move numbers', () => {
    expect(history.normalizeSan('12.♔e2+')).toBe('Ke2')
    expect(history.normalizeSan('Nf3 ')).toBe('Nf3')
    expect(history.normalizeSan('exd8=Q#')).toBe('exd8=Q')
    expect(history.castlingRights('KQkq', ['e4', 'e5', '♔e2', 'Nc6'])).toBe('kq')
  })

  it('never adds a right the board does not allow', () => {
    expect(history.castlingRights('K', ['e4'])).toBe('K')
    expect(history.castlingRights('-', ['e4'])).toBe('-')
    expect(history.castlingRights('KQ', ['e4', 'e5', 'Ke2'])).toBe('-')
  })
})
