import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

/** The API returns a PIN exactly once (on create or reset); this screen is the only place it appears. */
export function PinReveal({ title, pin, onDone }: { title: string; pin: string; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 20 }}>
        <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
          <Icon name="key" size={40} />
          <Text variant="h2" style={{ textAlign: 'center' }}>
            {title}
          </Text>
          <Text variant="monoHuge" selectable style={{ letterSpacing: 6 }}>
            {pin}
          </Text>
          <Text color={colors.muted} style={{ textAlign: 'center' }}>
            {t('admin.employees.pinHelp')}
          </Text>
        </Card>
        <Button label={t('common.done')} onPress={onDone} />
      </View>
    </Screen>
  );
}
