// src/renderer/overlay-main.tsx
import { createRoot } from 'react-dom/client'
import FloatingButton from './components/FloatingButton'

const root = document.getElementById('overlay-root')!
createRoot(root).render(<FloatingButton />)
