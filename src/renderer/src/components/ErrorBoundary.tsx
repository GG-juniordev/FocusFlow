import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useApp } from '@/state/useApp'

/**
 * Screens shown instead of a blank window when something goes wrong.
 * They use plain inline styles and fixed English text on purpose: they must
 * still work when the stylesheet, the theme or the translations are the thing
 * that failed.
 */

const wrap = {
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  padding: 32,
  background: '#161a24',
  color: '#e9ecf3',
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  WebkitAppRegion: 'drag'
} as const
const box = { maxWidth: 560, WebkitAppRegion: 'no-drag' } as const
const button = {
  marginTop: 20,
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  border: 0,
  background: '#f0a63a',
  color: '#1a1408',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer'
} as const
const detail = {
  marginTop: 16,
  padding: 12,
  borderRadius: 8,
  background: '#11141c',
  color: '#98a1b5',
  fontSize: 12,
  fontFamily: 'Consolas, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 220,
  overflow: 'auto',
  userSelect: 'text'
} as const

function Message({ title, body, technical, action }: { title: string; body: string; technical?: string; action: string }) {
  return (
    <div style={wrap} role="alert" data-testid="app-error">
      <div style={box}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h1>
        <p style={{ margin: '8px 0 0', color: '#98a1b5', fontSize: 15, lineHeight: 1.5 }}>{body}</p>
        {technical && <pre style={detail}>{technical}</pre>}
        <button type="button" style={button} onClick={() => window.location.reload()}>
          {action}
        </button>
      </div>
    </div>
  )
}

interface State {
  error: Error | null
  stack: string
}

/** Catches any error thrown while rendering the app and shows it, with a way to reload. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('FocusFlow: render error', error, info.componentStack)
    this.setState({ stack: info.componentStack ?? '' })
  }

  render(): ReactNode {
    const { error, stack } = this.state
    if (!error) return this.props.children
    return (
      <Message
        title="FocusFlow hit a problem"
        body="Something went wrong while drawing this screen. Your tasks and settings are saved on this PC and are not affected."
        technical={`${error.name}: ${error.message}${stack ? `\n${stack.trim().split('\n').slice(0, 6).join('\n')}` : ''}`}
        action="Reload"
      />
    )
  }
}

/**
 * Shown while the saved data is being loaded. Normally that takes a few
 * milliseconds and nothing is drawn; if it takes long or fails, say so.
 */
export function BootScreen() {
  const bootError = useApp((s) => s.bootError)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 2500)
    return () => clearTimeout(id)
  }, [])

  if (!slow && !bootError) return <div style={{ ...wrap, placeItems: 'start' }} />
  return (
    <Message
      title={bootError ? 'FocusFlow could not load your data' : 'Still starting…'}
      body={
        bootError
          ? 'The app window could not reach its data. It keeps retrying; you can also reload.'
          : 'Loading is taking longer than usual. It keeps trying; you can also reload.'
      }
      technical={bootError ?? undefined}
      action="Reload"
    />
  )
}
