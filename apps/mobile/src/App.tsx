import './i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './auth/AuthContext';
import { getDeviceInfo } from './native/device';
import { RootNavigator } from './navigation/RootNavigator';
import { createServices, type Services } from './services';
import { ErrorState, Loading } from './ui/Centered';

export default function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [failed, setFailed] = useState(false);

  const boot = useCallback(() => {
    setFailed(false);
    getDeviceInfo()
      .then((info) => setServices(createServices(info.apiUrl)))
      .catch((err: unknown) => {
        console.warn('app: boot failed', err);
        setFailed(true);
      });
  }, []);

  useEffect(boot, [boot]);

  // Refetch screens when the app comes back to the foreground (TanStack Query's focus on RN).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {services ? (
        <QueryClientProvider client={services.queryClient}>
          <AuthProvider client={services.client} api={services.api}>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      ) : failed ? (
        <ErrorState onRetry={boot} />
      ) : (
        <Loading />
      )}
    </SafeAreaProvider>
  );
}
