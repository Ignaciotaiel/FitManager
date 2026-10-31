import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../../Pages/auth/WelcomeScreen.js';
import { LoginScreen } from '../../Pages/auth/LoginScreen.js';
import { RegisterScreen } from '../../Pages/auth/RegisterScreen.js';
import { EmailVerificationScreen } from '../../Pages/auth/EmailVerificationScreen.js';
import { ForgotPasswordScreen } from '../../Pages/auth/ForgotPasswordScreen.js';
import { VerifyResetCodeScreen } from '../../Pages/auth/VerifyResetCodeScreen.js';
import { ResetPasswordScreen } from '../../Pages/auth/ResetPasswordScreen.js';
import { useTheme } from '../../contexto/themeContext.js';

const Stack = createNativeStackNavigator();

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
