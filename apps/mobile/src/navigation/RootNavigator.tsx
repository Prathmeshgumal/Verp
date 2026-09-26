import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/tokens';
import { Loading } from '../ui/Centered';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { WorkerNavigator } from './WorkerNavigator';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text } };

/** The role from the login response decides the navigator; admin screens never mount for employees. */
export function RootNavigator() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      {state.status !== 'loggedIn' ? (
        <AuthNavigator />
      ) : state.user.role === 'admin' ? (
        <AdminNavigator />
      ) : (
        <WorkerNavigator />
      )}
    </NavigationContainer>
  );
}
