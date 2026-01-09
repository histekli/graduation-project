import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

// Initial state
const initialState = {
    user: null,
    token: null,
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
    axios.defaults.baseURL = API_URL;

    // Request interceptor
    axios.interceptors.request.use(
        (config) => {
            if (token && !token.startsWith('guest_token_')) {
                config.headers.Authorization = `Bearer ${token}`;
                console.log('🔐 AuthContext: Token added to request');
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
    }, [state.token]);

    // Load token from storage on mount
    useEffect(() => {
        const loadToken = async () => {
            try {
                const token = await AsyncStorage.getItem('carvoice_token');
                const guestUserStr = await AsyncStorage.getItem('carvoice_guest_user');

                if (token) {
                    // Check for guest token
                    if (token.startsWith('guest_token_')) {
                        if (guestUserStr) {
                            const guestUser = JSON.parse(guestUserStr);
                            dispatch({
                                type: authActions.LOGIN_SUCCESS,
                                payload: { user: guestUser, token }
                            });
                        } else {
                            logout();
                        }
                        return;
                    }

                    // Verify normal token
                    try {
                        axios.defaults.baseURL = API_URL; // Ensure base URL is set before verification
                        const response = await axios.post('/api/auth/verify', { token });

                        if (response.data.valid) {
                            dispatch({
                                type: authActions.LOGIN_SUCCESS,
                                payload: {
                                    user: response.data.user,
                                    token: token
                                }
                            });
                        } else {
                            logout();
                        }
                    } catch (error) {
                        console.error('Token verification error:', error);
                        logout(); // Invalid or expired
                    }
                } else {
                    dispatch({ type: authActions.SET_LOADING, payload: false });
                }
            } catch (error) {
                console.error('AsyncStorage error:', error);
                dispatch({ type: authActions.SET_LOADING, payload: false });
            }
        };

        loadToken();
    }, []);

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

            await AsyncStorage.setItem('carvoice_token', token);

            dispatch({
                type: authActions.LOGIN_SUCCESS,
                payload: { user, token }
            });

            return { success: true };

        } catch (error) {
            const message = error.response?.data?.error || 'Giriş sırasında bir hata oluştu';
            dispatch({ type: authActions.SET_ERROR, payload: message });
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

            await AsyncStorage.setItem('carvoice_token', token);

            dispatch({
                type: authActions.LOGIN_SUCCESS,
                payload: { user, token }
            });

            return { success: true };

        } catch (error) {
            const message = error.response?.data?.error || 'Kayıt sırasında bir hata oluştu';
            dispatch({ type: authActions.SET_ERROR, payload: message });
            return { success: false, error: message };
        }
    }, []);

    // Guest Login function
    const loginAsGuest = useCallback(async (nickname) => {
        try {
            dispatch({ type: authActions.SET_LOADING, payload: true });
            dispatch({ type: authActions.CLEAR_ERROR });

            const guestUser = {
                _id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                username: nickname,
                email: `guest_${Date.now()}@temporary.local`,
                isGuest: true,
                createdAt: new Date().toISOString()
            };

            const guestToken = `guest_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await AsyncStorage.setItem('carvoice_token', guestToken);
            await AsyncStorage.setItem('carvoice_guest_user', JSON.stringify(guestUser));

            dispatch({
                type: authActions.LOGIN_SUCCESS,
                payload: { user: guestUser, token: guestToken }
            });

            return { success: true };

        } catch (error) {
            const message = 'Misafir girişi sırasında bir hata oluştu';
            dispatch({ type: authActions.SET_ERROR, payload: message });
            return { success: false, error: message };
        }
    }, []);

    // Logout function
    const logout = useCallback(async () => {
        try {
            await AsyncStorage.removeItem('carvoice_token');
            await AsyncStorage.removeItem('carvoice_guest_user');
            dispatch({ type: authActions.LOGOUT });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }, []);

    // Clear error
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
        loginAsGuest,
        logout,
        clearError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
