import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../../Pages/admin/AdminDashboardScreen.js';
import { UsersScreen } from '../../Pages/admin/UsersScreen.js';
import { ExercisesScreen } from '../../Pages/common/ExercisesScreen.js';
import { RoutineDetailScreen } from '../../Pages/common/RoutineDetailScreen.js';
import { WorkoutHistoryScreen } from '../../Pages/common/WorkoutHistoryScreen.js';
import { useTheme } from '../../contexto/themeContext.js';

const Stack = createNativeStackNavigator();

export function AdminNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="AdminDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="Users" component={UsersScreen} />
      <Stack.Screen name="Exercises" component={ExercisesScreen} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
    </Stack.Navigator>
  );
}

export default AdminNavigator;
