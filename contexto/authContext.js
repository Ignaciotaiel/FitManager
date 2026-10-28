import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { signOutGoogle } from '../Modules/auth/googleAuth';
import { API_BASE_URL } from '../Modules/api/client';

const TOKEN_KEY = 'fitmanager_auth_token';

// Funciones utilitarias para persistencia multiplataforma (SecureStore en móvil, localStorage en web)
const storage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      } catch (e) {
        console.warn('error al persistir en localStorage:', e);
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      } catch (e) {
        console.warn('error al eliminar de localStorage:', e);
      }
      return;
    }
    return SecureStore.deleteItemAsync(key);
  }
};

const AuthContext = createContext({
  user: null,
  token: null,
  role: null,
  loading: true,
  isAuthenticated: false,
  hasPersistedSession: false,
  login: async () => {},
  exitApp: () => {},
  resumeSession: () => {},
  logout: async () => {},
  updateProfile: () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSession, setActiveSession] = useState(true);
  const [loading, setLoading] = useState(true);

  // funcion para validar decodificacion basica de payload jwt
  const decodeJwtPayload = (jwtToken) => {
    try {
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return null;
      // decodificacion segura del payload base64url
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
        );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // restaurar sesion persistida al iniciar la aplicacion consultando al backend
  const restoreSession = useCallback(async () => {
    try {
      const savedToken = await storage.getItem(TOKEN_KEY);
      if (savedToken) {
        const payload = decodeJwtPayload(savedToken);
        const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;

        if (!payload || isExpired) {
          // token con formato invalido o expirado localmente
          await storage.deleteItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          setActiveSession(false);
          return;
        }

        // verificar validez y firma real consultando GET /api/auth/me en el backend
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${savedToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            setToken(savedToken);
            setUser(data?.data?.user || {
              id: payload.id,
              email: payload.email,
              role: payload.role
            });
            setActiveSession(true);
          } else if (response.status === 401 || response.status === 403) {
            // token revocado, rechazado o usuario inactivo en el servidor: limpiar
            await storage.deleteItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
            setActiveSession(false);
          } else {
            // error del servidor (500, etc.): se conserva el token para reintento sin borrarlo
            setToken(savedToken);
            setUser({
              id: payload.id,
              email: payload.email,
              role: payload.role
            });
            setActiveSession(true);
          }
        } catch (netError) {
          // error de red o timeout temporal: NO se borra el token, se preserva la sesion para permitir reintentos
          setToken(savedToken);
          setUser({
            id: payload.id,
            email: payload.email,
            role: payload.role
          });
          setActiveSession(true);
        }
      } else {
        setToken(null);
        setUser(null);
        setActiveSession(false);
      }
    } catch (error) {
      console.warn('no se pudo recuperar el token desde el almacenamiento', error);
      setToken(null);
      setUser(null);
      setActiveSession(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // inicio de sesion: guarda token seguro y extrae rol del payload firmado
  const login = async (newToken, userData) => {
    try {
      await storage.setItem(TOKEN_KEY, newToken);
      const payload = decodeJwtPayload(newToken);

      setToken(newToken);
      // respetamos el rol validado por el servidor
      const serverRole = payload?.role || userData?.role || 'member';
      setUser({
        ...(userData || {}),
        id: payload?.id || userData?.id,
        email: payload?.email || userData?.email,
        role: serverRole
      });
      setActiveSession(true);
    } catch (error) {
      console.warn('error al persistir el token', error);
      throw error;
    }
  };

  // 1. «Salir de FitManager»:
  // Vuelve a la pantalla de bienvenida conservando la sesión persistida
  // No elimina el JWT ni las credenciales ni cierra sesión del proveedor externo
  const exitApp = () => {
    setActiveSession(false);
  };

  // Permite volver a ingresar directamente al panel si hay una sesión persistida válida
  const resumeSession = () => {
    if (token && user) {
      setActiveSession(true);
    }
  };

  // 2. «Cerrar sesión por completo»:
  // Elimina de forma segura el JWT, limpia el estado en memoria
  // e invoca GoogleSignin.signOut únicamente en plataformas nativas
  const logout = async () => {
    try {
      // 1. Eliminar token
      await storage.deleteItem(TOKEN_KEY);
    } catch (error) {
      console.warn('error al eliminar token:', error);
    }

    // 2. Cerrar sesión de Google mediante el módulo multiplataforma (nativo en Android, no-op en web)
    try {
      await signOutGoogle();
    } catch (googleError) {
      console.warn('aviso al cerrar sesion de google:', googleError?.message);
    }

    // 3. Limpiar estado en memoria
    setToken(null);
    setUser(null);
    setActiveSession(false);
  };

  // actualizacion de perfil en memoria
  const updateProfile = (partialData) => {
    setUser((prev) => (prev ? { ...prev, ...partialData } : null));
  };

  const role = user?.role || null;
  const hasPersistedSession = Boolean(token && user);
  const isAuthenticated = Boolean(token && user && activeSession);

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      loading,
      activeSession,
      hasPersistedSession,
      isAuthenticated,
      login,
      exitApp,
      resumeSession,
      logout,
      updateProfile,
      restoreSession
    }),
    [user, token, role, loading, activeSession, hasPersistedSession, isAuthenticated, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}

export default AuthContext;
