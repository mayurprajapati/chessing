import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('../extension/src/content/content.js', import.meta.url), 'utf8')

// Pull single function declarations out of the content script so they can run
// against stubbed board helpers without loading the whole Chess.com page.
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`${name} not found`)
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`${name} is not closed`)
}

const before = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

function setup({ liveFen }) {
  const timers = []
  const context = {
    currentFen: before,
    liveFen,
    lastAutoMovePosition: 'set',
    autoMoveObservation: null,
    executed: [],
    evals: [],
    logs: [],
    findBoard: () => ({}),
    extractFEN: () => context.liveFen,
    executeMove: move => { context.executed.push(move); return true },
    requestEval: fen => context.evals.push(fen),
    log: (...args) => context.logs.push(args.join(' ')),
    moveObservationContext: () => 'game',
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  }
  runInNewContext([
    'const MAX_FAILED_AUTO_MOVES = 2; let _failedAutoMove = { key: null, count: 0 };',
    extractFunction('_fenKey'),
    extractFunction('_positionChangedSince'),
    extractFunction('_executeMoveVerified'),
    'globalThis.verify = _executeMoveVerified',
  ].join('\n'), context)
  const flush = () => { while (timers.length) timers.shift().fn() }
  return { context, flush }
}

it('treats a move as registered when the live board changed before the debounced FEN', () => {
  // The drag landed (live board shows e4) but the debounced observer has not
  // refreshed currentFen yet.
  const { context, flush } = setup({ liveFen: after })
  context.verify('e2e4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')
  flush()
  expect(context.executed).toEqual(['e2e4'])
  expect(context.logs.join('\n')).not.toMatch(/not registered/)
  expect(context.evals).toEqual([])
})

it('retries and re-evaluates when the board really did not change', () => {
  const { context, flush } = setup({ liveFen: before })
  context.verify('e2e4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')
  flush()
  expect(context.executed).toEqual(['e2e4', 'e2e4'])
  expect(context.evals).toEqual([before])
})

it('stops re-evaluating a position after the second failed auto-move', () => {
  const { context, flush } = setup({ liveFen: before })
  const key = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'
  context.verify('e2e4', key)
  flush()
  context.verify('e2e4', key)
  flush()
  expect(context.evals).toEqual([before])
  expect(context.lastAutoMovePosition).toBe(key)
  expect(context.logs.join('\n')).toMatch(/waiting for the position to change/)
})

it('falls back to the debounced FEN when the live board cannot be read', () => {
  const { context, flush } = setup({ liveFen: null })
  context.currentFen = after
  context.verify('e2e4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')
  flush()
  expect(context.executed).toEqual(['e2e4'])
})
