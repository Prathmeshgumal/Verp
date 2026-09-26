import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../attendance/format';
import type { OutcomeView, Tone } from '../../attendance/messages';
import { colors, fonts } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

const TONES: Record<Tone, { bg: string; circle: string; text: string; muted: string }> = {
  success: { bg: colors.successBg, circle: colors.checkIn, text: colors.successText, muted: colors.successMuted },
  problem: { bg: colors.problemBg, circle: colors.checkOut, text: colors.problemText, muted: colors.problemMuted },
  info: { bg: colors.infoBg, circle: colors.info, text: colors.infoText, muted: colors.info },
};

export function ResultView({ view, onAction }: { view: OutcomeView; onAction: () => void }) {
  const { t } = useTranslation();
  const tone = TONES[view.tone];
  return (
    <Screen background={tone.bg} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <View style={{ width: 168, height: 168, borderRadius: 84, backgroundColor: tone.circle, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={view.icon} size={84} color={colors.white} strokeWidth={2.4} />
          </View>
          <Text variant="display" color={tone.text} style={{ textAlign: 'center' }} accessibilityRole="header">
            {t(view.titleKey, view.titleParams)}
          </Text>
          {view.detailKey ? (
            <Text color={tone.muted} style={{ fontSize: 18, textAlign: 'center' }}>
              {t(view.detailKey)}
            </Text>
          ) : null}
          {view.time ? (
            <Text variant="monoHuge" color={tone.text}>
              {formatTime(view.time, t)}
            </Text>
          ) : null}
          {view.range ? (
            <Text variant="monoLarge" color={tone.text}>
              {`${formatTime(view.range.from, t)} – ${view.range.to ? formatTime(view.range.to, t) : '?'}`}
            </Text>
          ) : null}
          {view.tone === 'problem' ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text variant="bodyStrong" color={tone.text}>
                {t('result.notSaved')}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(view.actionKey)}
          onPress={onAction}
          style={({ pressed }) => ({
            height: 72,
            borderRadius: 18,
            backgroundColor: tone.text,
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {view.action === 'retry' ? <Icon name="refresh" color={colors.white} /> : null}
          <Text color={colors.white} style={{ fontFamily: fonts.heading, fontSize: 24 }}>
            {t(view.actionKey)}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
