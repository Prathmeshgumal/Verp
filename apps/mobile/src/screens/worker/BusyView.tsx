import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SubmitStep } from '../../attendance/submitFlow';
import { colors } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

export function BusyView({ step }: { step: SubmitStep | 'starting' }) {
  const { t } = useTranslation();
  const locating = step === 'starting' || step === 'locating';
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 28 }}>
        <View style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: colors.infoHalo, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: colors.infoRing, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={locating ? 'pin' : 'refresh'} size={40} color={colors.white} />
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text variant="h1" style={{ fontSize: 32, textAlign: 'center' }} accessibilityRole="header">
            {locating ? t('busy.locating') : step === 'saving' ? t('busy.saving') : t('busy.checking')}
          </Text>
          {locating ? <Text color={colors.muted} style={{ fontSize: 18 }}>{t('busy.locatingHelp')}</Text> : null}
        </View>
        <ActivityIndicator size="large" color={colors.info} />
      </View>
    </Screen>
  );
}
