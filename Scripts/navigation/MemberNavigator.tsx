import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MemberDashboardScreen } from '../../Pages/member/MemberDashboardScreen';
import { ExercisesScreen } from '../../Pages/common/ExercisesScreen';
import { RoutineDetailScreen } from '../../Pages/common/RoutineDetailScreen';
import { WorkoutHistoryScreen } from '../../Pages/common/WorkoutHistoryScreen';
import { NotificationsInboxScreen } from '../../Pages/common/NotificationsInboxScreen';
import { useTheme } from '../../contexto/themeContext';
import type { MemberStackParamList } from './types';

const Stack = createNativeStackNavigator<MemberStackParamList>();

export function MemberNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="MemberDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="MemberDashboard" component={MemberDashboardScreen} />
      <Stack.Screen name="Exercises" component={ExercisesScreen} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="NotificationsInbox" component={NotificationsInboxScreen} />
    </Stack.Navigator>
  );
}

export default MemberNavigator;
