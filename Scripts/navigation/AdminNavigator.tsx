import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../../Pages/admin/AdminDashboardScreen';
import { UsersScreen } from '../../Pages/admin/UsersScreen';
import { ExercisesScreen } from '../../Pages/common/ExercisesScreen';
import { RoutineDetailScreen } from '../../Pages/common/RoutineDetailScreen';
import { WorkoutHistoryScreen } from '../../Pages/common/WorkoutHistoryScreen';
import { ActivityLogScreen } from '../../Pages/admin/ActivityLogScreen';
import { NotificationsScreen } from '../../Pages/admin/NotificationsScreen';
import { IncidentsScreen } from '../../Pages/admin/IncidentsScreen';
import { ReportsExportScreen } from '../../Pages/admin/ReportsExportScreen';
import { useTheme } from '../../contexto/themeContext';
import type { AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

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
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen name="ReportsExport" component={ReportsExportScreen} />
    </Stack.Navigator>
  );
}

export default AdminNavigator;
