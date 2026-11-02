import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { signOutGoogle } from '../Modules/auth/googleAuth';
import { API_BASE_URL } from '../Modules/api/client';
import { User, UserRole } from '../Modules/types';

const TOKEN_KEY = 'fitmanager_auth_token';

// Funciones utilitarias para persistencia multiplataforma (SecureStore en móvil, localStorage en web)
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
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
  deleteItem: async (key: string): Promise<void> => {
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

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  loading: boolean;
  activeSession: boolean;
  isAuthenticated: boolean;
  hasPersistedSession: boolean;
  login: (newToken: string, userData?: Partial<User>) => Promise<void>;
  exitApp: () => void;
  resumeSession: () => void;
  logout: () => Promise<void>;
  updateProfile: (partialData: Partial<User>) => void;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  role: null,
  loading: true,
  activeSession: true,
  isAuthenticated: false,
  hasPersistedSession: false,
  login: async () => {},
  exitApp: () => {},
  resumeSession: () => {},
  logout: async () => {},
  updateProfile: () => {},
  restoreSession: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // funcion para validar decodificacion basica de payload jwt
  const decodeJwtPayload = (jwtToken: string): any => {
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
              name: payload.name || payload.email?.split('@')[0],
              email: payload.email,
              role: payload.role as UserRole,
              is_active: 1
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
              name: payload.name || payload.email?.split('@')[0],
              email: payload.email,
              role: payload.role as UserRole,
              is_active: 1
            });
            setActiveSession(true);
          }
        } catch {
          // error de red o timeout temporal: NO se borra el token, se preserva la sesion para permitir reintentos
          setToken(savedToken);
          setUser({
            id: payload.id,
            name: payload.name || payload.email?.split('@')[0],
            email: payload.email,
            role: payload.role as UserRole,
            is_active: 1
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
  const login = async (newToken: string, userData?: Partial<User>) => {
    try {
      await storage.setItem(TOKEN_KEY, newToken);
      const payload = decodeJwtPayload(newToken);

      setToken(newToken);
      // respetamos el rol validado por el servidor
      const serverRole = (payload?.role || userData?.role || 'member') as UserRole;
      setUser({
        id: payload?.id || userData?.id || 0,
        name: userData?.name || payload?.name || userData?.email?.split('@')[0] || 'Usuario',
        email: payload?.email || userData?.email || '',
        role: serverRole,
        is_active: userData?.is_active !== undefined ? userData.is_active : 1,
        ...(userData || {})
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
    } catch (googleError: any) {
      console.warn('aviso al cerrar sesion de google:', googleError?.message);
    }

    // 3. Limpiar estado en memoria
    setToken(null);
    setUser(null);
    setActiveSession(false);
  };

  // actualizacion de perfil en memoria
  const updateProfile = (partialData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...partialData } : null));
  };

  const role = user?.role || null;
  const hasPersistedSession = Boolean(token && user);
  const isAuthenticated = Boolean(token && user && activeSession);

  const value = useMemo<AuthContextValue>(
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}

export default AuthContext;

