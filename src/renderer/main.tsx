import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppShell } from './components/AppShell'
import './styles/globals.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
)
