import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fitmanager_auth_token';

const AuthContext = createContext({
  user: null,
  token: null,
  role: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  updateProfile: () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
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
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) {
        const payload = decodeJwtPayload(savedToken);
        const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;

        if (!payload || isExpired) {
          // token con formato invalido o expirado localmente
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setToken(null);
          setUser(null);
          return;
        }

        // verificar validez y firma real consultando GET /api/auth/me en el backend
        try {
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';
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
          } else if (response.status === 401 || response.status === 403) {
            // token revocado, rechazado o usuario inactivo en el servidor: limpiar
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            setToken(null);
            setUser(null);
          } else {
            // error del servidor (500, etc.): se conserva el token para reintento sin borrarlo
            setToken(savedToken);
            setUser({
              id: payload.id,
              email: payload.email,
              role: payload.role
            });
          }
        } catch (netError) {
          // error de red o timeout temporal: NO se borra el token, se preserva la sesion para permitir reintentos
          setToken(savedToken);
          setUser({
            id: payload.id,
            email: payload.email,
            role: payload.role
          });
        }
      }
    } catch (error) {
      console.warn('no se pudo recuperar el token desde securestore', error);
      setToken(null);
      setUser(null);
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
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
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
    } catch (error) {
      console.warn('error al persistir el token en securestore', error);
      throw error;
    }
  };

  // cierre de sesion: limpia almacenamiento seguro y estado en memoria
  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.warn('error al eliminar token de securestore', error);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  // actualizacion de perfil en memoria
  const updateProfile = (partialData) => {
    setUser((prev) => (prev ? { ...prev, ...partialData } : null));
  };

  const role = user?.role || null;
  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      loading,
      isAuthenticated,
      login,
      logout,
      updateProfile,
      restoreSession
    }),
    [user, token, role, loading, isAuthenticated, restoreSession]
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
