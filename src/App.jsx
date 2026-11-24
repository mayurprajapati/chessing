import { useEffect, useState, useRef } from 'react'
import DesktopShell from '../ui-template/src/DesktopShell'
import { Icon } from '../ui-template/src/icons'
import logo from './assets/logo.png'
import SidebarShortcuts from './components/Sidebar'
import { IconEval, IconSetup } from './components/icons'
import ChessingSettings from './components/ChessingSettings'
import EvaluationPage from './pages/EvaluationPage'
import SetupPage from './pages/SetupPage'
import AboutPage from './pages/AboutPage'

const piecesKey = (fen) => (fen ? fen.split(' ')[0] : '')
const brand = {
  name: 'Chessing',
  caption: 'Desktop analysis',
  mark: <img className="chessing-brand-logo" src={logo} alt="" />,
}
const navigation = [
  { id: 'evaluation', label: 'Evaluation', icon: <IconEval aria-hidden="true" /> },
  { id: 'setup', label: 'Setup', icon: <IconSetup aria-hidden="true" /> },
  { id: 'about', label: 'About', icon: <Icon name="info" /> },
  { id: 'settings', label: 'Settings', icon: <Icon name="settings" /> },
]

const windowControls = {
  minimize: () => window.chessing.minimizeWindow(),
  toggleMaximize: () => window.chessing.maximizeWindow(),
  close: () => window.chessing.closeWindow(),
  isMaximized: () => window.chessing.isWindowMaximized(),
  onMaximizedChange: callback => window.chessing.onWindowMaximizedChange(callback),
}

export default function App() {
  const [status, setStatus] = useState({ stockfishOk: false, stockfishState: 'starting', overlayOk: false, extensionConnected: false, extensionUpdateAvailable: false, chessConnected: false, chessSite: null, message: '' })
  const [ev, setEv] = useState(null)
  const [autoMoveStatus, setAutoMoveStatus] = useState(null)
  const [pos, setPos] = useState(null)        // { fen, flipped } — authoritative current position
  const [page, setPage] = useState('evaluation')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [settings, setSettings] = useState({ game: null, engine: null })
  const [settingsError, setSettingsError] = useState('')
  const [settingsLoadError, setSettingsLoadError] = useState('')
  const [shortcutIds, setShortcutIds] = useState(null)
  const [shortcutError, setShortcutError] = useState('')
  const settingWrites = useRef(new Map())
  const posRef = useRef(null)

  useEffect(() => {
    let mounted = true
    const api = window.chessing
    const load = (scope, read) => read().then(values => {
      if (mounted) setSettings(previous => ({ ...previous, [scope]: values }))
    }).catch(() => {
      if (mounted) setSettingsLoadError('Could not load some settings. Restart Chessing to try again.')
    })
    load('game', api.getGameSettings)
    load('engine', api.getEngineSettings)
    api.getSidebarShortcuts().then(ids => {
      if (mounted) setShortcutIds(ids)
    }).catch(() => {
      if (mounted) setShortcutError('Could not load shortcuts.')
    })
    return () => { mounted = false }
  }, [])

  async function changeSetting(scope, key, value) {
    const api = window.chessing
    const read = scope === 'game' ? api.getGameSettings : api.getEngineSettings
    const write = scope === 'game' ? api.setGameOption : api.setEngineOption
    const field = `${scope}.${key}`
    const request = Symbol(field)
    const previousValue = settings[scope][key]
    const update = (nextValue) => setSettings(previous => ({
      ...previous, [scope]: { ...previous[scope], [key]: nextValue },
    }))
    settingWrites.current.set(field, request)
    setSettingsError('')
    update(value)

    try {
      const saved = await write(key, value)
      if (!saved || !Object.hasOwn(saved, key)) throw new Error('Missing saved setting')
      if (settingWrites.current.get(field) === request) update(saved[key])
    } catch {
      if (settingWrites.current.get(field) !== request) return
      const saved = await read().catch(() => null)
      if (settingWrites.current.get(field) !== request) return
      update(saved && Object.hasOwn(saved, key) ? saved[key] : previousValue)
      setSettingsError('Could not save the setting. Try again.')
    }
  }

  function changeShortcuts(ids) {
    const previousIds = shortcutIds
    setShortcutError('')
    setShortcutIds(ids)
    window.chessing.setSidebarShortcuts(ids).then(saved => {
      setShortcutIds(current => current === ids ? saved : current)
    }).catch(() => {
      setShortcutIds(current => current === ids ? previousIds : current)
      setShortcutError('Could not save shortcuts.')
    })
  }

  useEffect(() => {
    window.chessing.getStatus().then(setStatus)
    const offS = window.chessing.onStatus((nextStatus) => {
      setStatus(nextStatus)
      if (nextStatus.stockfishState !== 'ready') setEv(null)
      if (!nextStatus.chessConnected) setAutoMoveStatus(null)
    })
    const offP = window.chessing.onPosition?.((p) => {
      posRef.current = p
      setPos(previous => previous?.fen === p?.fen && previous?.flipped === p?.flipped ? previous : p)
    })
    const offE = window.chessing.onEval((e) => {
      // Ignore speculative / stale evals — only show ones for the current board.
      const cur = posRef.current?.fen
      if (cur && e.fen && piecesKey(e.fen) !== piecesKey(cur)) return
      setEv(e)
    })
    const offMove = window.chessing.onAutoMoveStatus?.(setAutoMoveStatus)
    // Auto-check for updates on launch.
    window.chessing.checkUpdate?.().then(setUpdateStatus).catch(() => {})
    return () => { offS(); offE(); offP?.(); offMove?.() }
  }, [])

  const updateAvailable = !!updateStatus?.available
  const engineReady = status.stockfishOk && status.extensionConnected

  return (
    <DesktopShell brand={brand} items={navigation} page={page} onNavigate={setPage} windowControls={windowControls}
      sidebarTools={<SidebarShortcuts settings={settings} shortcutIds={shortcutIds} shortcutError={shortcutError}
        onSettingChange={changeSetting} onShortcutsChange={changeShortcuts} />}
      sidebarFooter={<div className="workspace">
        <span className="workspace-avatar chessing-connection" data-ready={engineReady} aria-hidden="true"><span /></span>
        <div className="workspace-copy">
          <strong>{engineReady ? 'Ready' : 'Setup'}</strong>
          <span>{status.extensionConnected ? 'Extension connected' : 'Extension disconnected'}</span>
        </div>
      </div>}
      banner={<>
        {updateAvailable && page !== 'about' && <div className="chessing-banner">
          <span>A new version is available.</span>
          <button type="button" className="button button-primary" onClick={() => setPage('about')}>View update</button>
        </div>}
        {status.message && page !== 'setup' && <div className="chessing-banner chessing-banner--status">{status.message}</div>}
      </>}
    >
      <div key={page} className={page === 'evaluation' ? 'chessing-evaluation' : undefined}>
        {page === 'evaluation' && <EvaluationPage ev={ev} pos={pos} status={status} gameSettings={settings.game}
          autoMoveStatus={autoMoveStatus} onOpenSetup={() => setPage('setup')} />}
        {page === 'setup' && <SetupPage status={status} />}
        {page === 'settings' && <ChessingSettings gameSettings={settings.game} engineSettings={settings.engine}
          onGameChange={(key, value) => changeSetting('game', key, value)}
          onEngineChange={(key, value) => changeSetting('engine', key, value)}
          loadError={settingsLoadError} />}
      </div>
      <div hidden={page !== 'about'}>
        <AboutPage updateStatus={updateStatus} onUpdateStatus={setUpdateStatus} />
      </div>
      {settingsError && (
        <div role="alert" style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 1001, padding: '8px 12px', fontSize: 12,
          color: 'rgb(var(--status-red))', background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))',
          borderRadius: 'var(--radius-sm)',
        }}>
          {settingsError}
        </div>
      )}
    </DesktopShell>
  )
}
