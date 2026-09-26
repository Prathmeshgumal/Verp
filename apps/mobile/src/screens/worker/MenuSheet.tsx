import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '../../auth/AuthContext';
import { getDeviceInfo } from '../../native/device';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';

/** Shared confirm-then-logout used by the worker menu and the admin Today screen. */
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

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useUser();
  const { logout } = useAuth();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    getDeviceInfo()
      .then((info) => setVersion(info.appVersion))
      .catch(() => setVersion(null));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(27,29,31,0.4)' }} />
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 16 }}>
        <View style={{ gap: 2 }}>
          <Text variant="h2">{user.name}</Text>
          {user.phone ? <Text variant="mono" color={colors.muted}>{user.phone}</Text> : null}
        </View>
        <Button label={t('common.logout')} variant="secondary" icon="logout" onPress={() => confirmLogout(t, logout, onClose)} />
        <Button label={t('common.close')} variant="link" size="small" onPress={onClose} />
        {version ? (
          <Text variant="small" color={colors.muted} style={{ textAlign: 'center' }}>
            {t('menu.appVersion', { version })}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
