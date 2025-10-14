import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('carvoice_token'),
  loading: true,
  error: null
};

// Action types
const authActions = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER'
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case authActions.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case authActions.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null
      };
    
    case authActions.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null
      };
    
    case authActions.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case authActions.CLEAR_ERROR:
      return { ...state, error: null };
    
    case authActions.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext();

// Axios interceptor setup
const setupAxiosInterceptors = (token, logout) => {
  // HTTPS sayfasından HTTP backend'e istek atamayız (Mixed Content)
  // Bu yüzden relative URL kullanarak aynı origin'den istek atıyoruz
  // Frontend server'ı backend'e proxy yapacak
  axios.defaults.baseURL = '';
  
  // Request interceptor
  axios.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // Response interceptor
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
        toast.error('Oturum süreniz doldu, lütfen tekrar giriş yapın');
      }
      return Promise.reject(error);
    }
  );
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Setup axios when token changes
  useEffect(() => {
    setupAxiosInterceptors(state.token, logout);
  }, [state.token]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Check token validity on mount
  useEffect(() => {
    const checkToken = async () => {
      if (state.token) {
        try {
          dispatch({ type: authActions.SET_LOADING, payload: true });
          
          const response = await axios.post('/api/auth/verify', {
            token: state.token
          });
          
          if (response.data.valid) {
            dispatch({
              type: authActions.LOGIN_SUCCESS,
              payload: {
                user: response.data.user,
                token: state.token
              }
            });
          } else {
            logout();
          }
        } catch (error) {
          console.error('Token verification error:', error);
          logout();
        }
      } else {
        dispatch({ type: authActions.SET_LOADING, payload: false });
      }
    };
    
    checkToken();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Login function
  const login = useCallback(async (email, password) => {
    try {
      dispatch({ type: authActions.SET_LOADING, payload: true });
      dispatch({ type: authActions.CLEAR_ERROR });
      
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      const { user, token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('carvoice_token', token);
      
      dispatch({
        type: authActions.LOGIN_SUCCESS,
        payload: { user, token }
      });
      
      toast.success(`Hoş geldiniz, ${user.username}!`);
      return { success: true };
      
    } catch (error) {
      const message = error.response?.data?.error || 'Giriş sırasında bir hata oluştu';
      dispatch({ type: authActions.SET_ERROR, payload: message });
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);
  
  // Register function
  const register = useCallback(async (userData) => {
    try {
      dispatch({ type: authActions.SET_LOADING, payload: true });
      dispatch({ type: authActions.CLEAR_ERROR });
      
      const response = await axios.post('/api/auth/register', userData);
      
      const { user, token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('carvoice_token', token);
      
      dispatch({
        type: authActions.LOGIN_SUCCESS,
        payload: { user, token }
      });
      
      toast.success(`Kayıt başarılı! Hoş geldiniz, ${user.username}!`);
      return { success: true };
      
    } catch (error) {
      const message = error.response?.data?.error || 'Kayıt sırasında bir hata oluştu';
      dispatch({ type: authActions.SET_ERROR, payload: message });
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);
  
  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('carvoice_token');
    dispatch({ type: authActions.LOGOUT });
    toast.success('Çıkış yapıldı');
  }, []);
  
  // Update user function
  const updateUser = useCallback((userData) => {
    dispatch({ type: authActions.UPDATE_USER, payload: userData });
  }, []);
  
  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: authActions.CLEAR_ERROR });
  }, []);
  
  const value = {
    user: state.user,
    token: state.token,
    loading: state.loading,
    error: state.error,
    login,
    register,
    logout,
    updateUser,
    clearError
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
