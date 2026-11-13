// Punto de entrada visual que integra proveedores de estado global, tema y navegación.
import React, { useState, useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './contexto/themeContext';
import { AuthProvider } from './contexto/authContext';
import { AppNavigator } from './Scripts/navigation/AppNavigator';

// Sincroniza el estado de la ruta activa con el contenedor principal y la barra de estado.
function NavigationWrapper() {
  const { isDark } = useTheme();
  const navigationRef = useNavigationContainerRef<any>();
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(undefined);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);

  const syncRouteState = useCallback(() => {
    if (!navigationRef.isReady()) return;
    const route = navigationRef.getCurrentRoute();
    setCurrentRouteName(route?.name);
    setCanGoBack(navigationRef.canGoBack());
  }, [navigationRef]);

  const handleNavigate = useCallback(
    (routeName: string, params?: any) => {
      if (!navigationRef.isReady()) return;
      (navigationRef as any).navigate(routeName, params);
    },
    [navigationRef]
  );

  const handleGoBack = useCallback(() => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  }, [navigationRef]);

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onReady={syncRouteState}
        onStateChange={syncRouteState}
      >
        <AppNavigator
          currentRouteName={currentRouteName}
          canGoBack={canGoBack}
          onNavigate={handleNavigate}
          onGoBack={handleGoBack}
        />
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationWrapper />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

