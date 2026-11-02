import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../../Pages/auth/WelcomeScreen';
import { LoginScreen } from '../../Pages/auth/LoginScreen';
import { RegisterScreen } from '../../Pages/auth/RegisterScreen';
import { EmailVerificationScreen } from '../../Pages/auth/EmailVerificationScreen';
import { ForgotPasswordScreen } from '../../Pages/auth/ForgotPasswordScreen';
import { VerifyResetCodeScreen } from '../../Pages/auth/VerifyResetCodeScreen';
import { ResetPasswordScreen } from '../../Pages/auth/ResetPasswordScreen';
import { useTheme } from '../../contexto/themeContext';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade_from_bottom'
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

export default AuthNavigator;
