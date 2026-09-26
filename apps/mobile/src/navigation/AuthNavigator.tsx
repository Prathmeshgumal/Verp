import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminLoginScreen } from '../screens/login/AdminLoginScreen';
import { WorkerLoginScreen } from '../screens/login/WorkerLoginScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkerLogin" component={WorkerLoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
    </Stack.Navigator>
  );
}
