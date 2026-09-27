import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

/** Shared confirm-then-logout used by the worker Profile tab and the admin Today screen. */
export function confirmLogout(t: TFunction, logout: () => Promise<void>, onDone?: () => void) {
  Alert.alert(t('menu.logoutTitle'), t('menu.logoutBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.logout'),
      style: 'destructive',
      onPress: () => {
        onDone?.();
        void logout();
      },
    },
  ]);
}
