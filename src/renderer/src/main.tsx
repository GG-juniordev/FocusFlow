import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/hanken-grotesk'
import './styles.css'
import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { App } from './App'
import { BootScreen, ErrorBoundary } from './components/ErrorBoundary'
import { MiniWidget } from './features/focus/MiniWidget'
import { useBoot } from './lib/hooks'

// The same bundle serves both windows: the dashboard, and the floating bar at #mini.
const mini = window.location.hash === '#mini'
if (mini) document.body.classList.add('mini')

function Mini() {
  return useBoot() ? <MiniWidget /> : <BootScreen />
}

/** Reports to the main process that something is on screen, so it knows the window is not blank. */
function Mounted({ children }: { children: ReactNode }) {
  useEffect(() => window.api?.ready(), [])
  return children
}

// reducedMotion="user": with Windows "Animation effects" turned off, movement is dropped and only fades remain.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Mounted>
      {/* Any render error shows an explanation and a Reload button, never an empty window. */}
      <ErrorBoundary>
        <MotionConfig reducedMotion="user">{mini ? <Mini /> : <App />}</MotionConfig>
      </ErrorBoundary>
    </Mounted>
  </StrictMode>
)
