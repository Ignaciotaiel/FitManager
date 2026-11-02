import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from '../Styles/theme/colors';
import { createCommonStyles } from '../Styles/commonStyles';

const THEME_STORAGE_KEY = '@fitmanager_theme_preference';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createCommonStyles>;
  loading: boolean;
  toggleTheme: () => void;
  setThemeMode: (newTheme: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  styles: createCommonStyles(darkColors),
  loading: false,
  toggleTheme: () => {},
  setThemeMode: async () => {}
});

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [loading, setLoading] = useState<boolean>(true);

  // recuperar preferencia guardada al iniciar la aplicacion
  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setTheme(storedTheme);
        }
      } catch (error) {
        // en caso de fallo de lectura, se conserva el tema oscuro por defecto
        console.warn('no se pudo cargar la preferencia de tema desde asyncstorage', error);
      } finally {
        setLoading(false);
      }
    }

    loadStoredTheme();
  }, []);

  // guardar cambio de tema
  const setThemeMode = async (newTheme: ThemeMode) => {
    if (newTheme !== 'light' && newTheme !== 'dark') return;
    try {
      setTheme(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.warn('no se pudo guardar la preferencia de tema en asyncstorage', error);
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const styles = useMemo(() => createCommonStyles(colors), [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark,
      colors,
      styles,
      loading,
      toggleTheme,
      setThemeMode
    }),
    [theme, isDark, colors, styles, loading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe utilizarse dentro de un ThemeProvider');
  }
  return context;
}

export default ThemeContext;

