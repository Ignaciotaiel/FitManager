import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TrainerDashboardScreen } from '../../Pages/trainer/TrainerDashboardScreen.js';
import { ExercisesScreen } from '../../Pages/common/ExercisesScreen.js';
import { RoutineDetailScreen } from '../../Pages/common/RoutineDetailScreen.js';
import { WorkoutHistoryScreen } from '../../Pages/common/WorkoutHistoryScreen.js';
import { TrainerStudentsHistoryScreen } from '../../Pages/trainer/TrainerStudentsHistoryScreen.js';
import { useTheme } from '../../contexto/themeContext.js';

const Stack = createNativeStackNavigator();

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
    </Stack.Navigator>
  );
}

export default TrainerNavigator;
