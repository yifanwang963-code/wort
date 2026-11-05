import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { listenForRestore } from './data-events.js'
import { registerServiceWorker } from './pwa.js'

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
listenForRestore()
registerServiceWorker()
