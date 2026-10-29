import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './contexto/themeContext.js';
import { AuthProvider } from './contexto/authContext.js';
import { AppNavigator } from './Scripts/navigation/AppNavigator.js';

function NavigationWrapper() {
  const { isDark } = useTheme();

  return (
    <>
      <NavigationContainer>
        <AppNavigator />
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

