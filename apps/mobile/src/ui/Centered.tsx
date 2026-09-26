import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export function Loading() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text color={colors.muted}>{t('common.loading')}</Text>
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.bg }}>
      <Icon name="wifiOff" size={48} color={colors.muted} />
      <Text variant="h2">{t('common.noInternet')}</Text>
      <Text color={colors.muted} style={{ textAlign: 'center' }}>
        {t('common.noInternetHelp')}
      </Text>
      <Button label={t('common.tryAgain')} icon="refresh" onPress={onRetry} />
    </View>
  );
}
