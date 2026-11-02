import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// pantallas compartidas entre varios roles
export type CommonStackParamList = {
  Exercises: undefined;
  NotificationsInbox: undefined;
  RoutineDetail: { routineId: number | string };
  WorkoutHistory: { memberId?: number | string; memberName?: string } | undefined;
};

// flujo publico de autenticacion
export type AuthStackParamList = {
  Welcome: undefined;
  Login: { verifiedEmail?: string } | undefined;
  Register: undefined;
  EmailVerification: { email: string };
  ForgotPassword: undefined;
  VerifyResetCode: { email: string };
  ResetPassword: { email: string; resetToken: string };
};

// navegacion del administrador (incluye las 4 funciones administrativas nuevas)
export type AdminStackParamList = CommonStackParamList & {
  AdminDashboard: undefined;
  Users: undefined;
  ActivityLog: undefined;
  Notifications: undefined;
  Incidents: undefined;
  ReportsExport: undefined;
};

export type TrainerStackParamList = CommonStackParamList & {
  TrainerDashboard: undefined;
  TrainerStudentsHistory: undefined;
};

export type MemberStackParamList = CommonStackParamList & {
  MemberDashboard: undefined;
};

// union de todas las rutas de la aplicacion
export type AppParamList = AuthStackParamList &
  AdminStackParamList &
  TrainerStackParamList &
  MemberStackParamList;

export type ScreenProps<RouteName extends keyof AppParamList> = NativeStackScreenProps<
  AppParamList,
  RouteName
>;
