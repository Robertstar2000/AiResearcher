import { configureStore } from '@reduxjs/toolkit'
import researchReducer from './slices/researchSlice'
import authReducer from './slices/authSlice'

export const store = configureStore({
  reducer: {
    research: researchReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Log initial state
console.log('Initial Redux State:', store.getState())

store.subscribe(() => {
  const state = store.getState()
  if (state.research.error) {
    console.error('Research Error:', state.research.error)
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
