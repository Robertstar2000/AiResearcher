import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  occupation?: string;
  geolocation?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  error: string | null;
}

const LOCAL_STORAGE_KEY = 'ai_researcher_auth';

// Load initial state from localStorage
const loadInitialState = (): AuthState => {
  try {
    const savedAuth = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedAuth) {
      const parsedAuth = JSON.parse(savedAuth);
      return {
        isAuthenticated: true,
        user: parsedAuth.user,
        error: null,
      };
    }
  } catch (error) {
    console.error('Error loading auth state from localStorage:', error);
  }
  return {
    isAuthenticated: false,
    user: null,
    error: null,
  };
};

const initialState: AuthState = loadInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
      // Save to localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ user: action.payload }));
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
      // Clear from localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    },
  },
})

export const { setUser, setAuthError, clearAuthError, logout } = authSlice.actions

export default authSlice.reducer
