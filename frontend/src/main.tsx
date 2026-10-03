import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyTheme, applyThemeColor, getTheme, watchSystemTheme } from './lib/theme'
import { AuthProvider } from './context/AuthContext'
import { UiProvider } from './context/UiContext'

// Aplica el tema guardado antes del primer render para evitar parpadeo.
applyTheme(getTheme())
applyThemeColor()
// En 'auto', si el SO cambia de claro a oscuro con la app abierta, la barra del
// navegador acompaña (el resto ya lo resuelve el media query del CSS).
watchSystemTheme(() => applyThemeColor())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  </StrictMode>,
)
