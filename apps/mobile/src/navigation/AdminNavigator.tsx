import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AttendanceDetailScreen } from '../screens/admin/AttendanceDetailScreen';
import { AttendanceListScreen } from '../screens/admin/AttendanceListScreen';
import { EmployeeCreateScreen } from '../screens/admin/EmployeeCreateScreen';
import { EmployeeDetailScreen } from '../screens/admin/EmployeeDetailScreen';
import { EmployeesScreen } from '../screens/admin/EmployeesScreen';
import { TodayScreen } from '../screens/admin/TodayScreen';
import { colors, fonts } from '../theme/tokens';
import { TabBar } from '../ui/TabBar';
import type { AdminTabParamList, AttendanceStackParamList, EmployeesStackParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const AttendanceStack = createNativeStackNavigator<AttendanceStackParamList>();

/** Header style for pushed admin screens (detail, create, edit). */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.bg },
};

const ITEMS = {
  TodayTab: { icon: 'home', labelKey: 'tabs.today' },
  EmployeesTab: { icon: 'users', labelKey: 'tabs.employees' },
  SitesTab: { icon: 'map', labelKey: 'tabs.sites' },
  AttendanceTab: { icon: 'list', labelKey: 'tabs.attendance' },
} as const;

function AttendanceNavigator() {
  const { t } = useTranslation();
  return (
    <AttendanceStack.Navigator screenOptions={stackScreenOptions}>
      <AttendanceStack.Screen name="AttendanceList" component={AttendanceListScreen} options={{ headerShown: false }} />
      <AttendanceStack.Screen name="AttendanceDetail" component={AttendanceDetailScreen} options={{ title: t('admin.attendance.title') }} />
    </AttendanceStack.Navigator>
  );
}
const EmployeesStack = createNativeStackNavigator<EmployeesStackParamList>();

function EmployeesNavigator() {
  const { t } = useTranslation();
  return (
    <EmployeesStack.Navigator screenOptions={stackScreenOptions}>
      <EmployeesStack.Screen name="Employees" component={EmployeesScreen} options={{ headerShown: false }} />
      <EmployeesStack.Screen name="EmployeeCreate" component={EmployeeCreateScreen} options={{ title: t('admin.employees.createTitle') }} />
      <EmployeesStack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ title: t('admin.employees.detailTitle') }} />
    </EmployeesStack.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} items={ITEMS} height={68} />}>
      <Tab.Screen name="TodayTab" component={TodayScreen} />
      <Tab.Screen name="EmployeesTab" component={EmployeesNavigator} />
      <Tab.Screen name="AttendanceTab" component={AttendanceNavigator} />
    </Tab.Navigator>
  );
}
