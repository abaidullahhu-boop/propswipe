import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      
      // Persist to localStorage
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      localStorage.setItem('token', action.payload.token);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },
    loadFromStorage: (state) => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      
      if (storedUser && storedToken) {
        state.user = JSON.parse(storedUser);
        state.token = storedToken;
        state.isAuthenticated = true;
      }
      state.isLoading = false;
    },
  },
});

export const { setCredentials, logout, loadFromStorage } = authSlice.actions;
export default authSlice.reducer;
