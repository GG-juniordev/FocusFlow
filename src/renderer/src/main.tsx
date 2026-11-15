import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/hanken-grotesk'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { App } from './App'
import { MiniWidget } from './features/focus/MiniWidget'
import { useBoot } from './lib/hooks'

// The same bundle serves both windows: the dashboard, and the floating bar at #mini.
const mini = window.location.hash === '#mini'
if (mini) document.body.classList.add('mini')

function Mini() {
  return useBoot() ? <MiniWidget /> : null
}

// reducedMotion="user": with Windows "Animation effects" turned off, movement is dropped and only fades remain.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">{mini ? <Mini /> : <App />}</MotionConfig>
  </StrictMode>
)
