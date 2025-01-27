import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import CssBaseline from '@mui/material/CssBaseline'
import { StyledEngineProvider } from '@mui/material/styles'

import App from './App'
import { store } from './store'
import theme from './theme'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

console.log('Starting application...')

// Create emotion cache
const emotionCache = createCache({
  key: 'css',
  prepend: true
});

const init = async () => {
  try {
    console.log('Initializing application...')
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      console.error('Failed to find the root element')
      throw new Error('Failed to find the root element')
    }

    console.log('Root element found, creating React root...')
    const root = ReactDOM.createRoot(rootElement)

    console.log('Setting up providers...')
    const app = (
      <React.StrictMode>
        <ErrorBoundary>
          <StyledEngineProvider injectFirst>
            <CacheProvider value={emotionCache}>
              <Provider store={store}>
                <BrowserRouter>
                  <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <App />
                  </ThemeProvider>
                </BrowserRouter>
              </Provider>
            </CacheProvider>
          </StyledEngineProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );

    console.log('Rendering application...')
    root.render(app)
    console.log('Application rendered successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }
}

init()
