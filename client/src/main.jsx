import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { applyAccentTheme, THEME_STORAGE_KEY } from './utils/themes.js'

applyAccentTheme(localStorage.getItem(THEME_STORAGE_KEY) ?? 'gold')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
