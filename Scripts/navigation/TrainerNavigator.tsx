import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TrainerDashboardScreen } from '../../Pages/trainer/TrainerDashboardScreen';
import { ExercisesScreen } from '../../Pages/common/ExercisesScreen';
import { RoutineDetailScreen } from '../../Pages/common/RoutineDetailScreen';
import { WorkoutHistoryScreen } from '../../Pages/common/WorkoutHistoryScreen';
import { TrainerStudentsHistoryScreen } from '../../Pages/trainer/TrainerStudentsHistoryScreen';
import { NotificationsInboxScreen } from '../../Pages/common/NotificationsInboxScreen';
import { useTheme } from '../../contexto/themeContext';
import type { TrainerStackParamList } from './types';

const Stack = createNativeStackNavigator<TrainerStackParamList>();

export function TrainerNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="TrainerDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="TrainerDashboard" component={TrainerDashboardScreen} />
      <Stack.Screen name="TrainerStudentsHistory" component={TrainerStudentsHistoryScreen} />
      <Stack.Screen name="Exercises" component={ExercisesScreen} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="NotificationsInbox" component={NotificationsInboxScreen} />
    </Stack.Navigator>
  );
}

export default TrainerNavigator;
