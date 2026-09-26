import React from 'react';
import { View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props {
  tone: 'warn' | 'info';
  icon: IconName;
  title: string;
  body?: string;
}

export function Banner({ tone, icon, title, body }: Props) {
  const warn = tone === 'warn';
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: 2,
        backgroundColor: warn ? colors.warnBg : colors.infoBg,
        borderColor: warn ? colors.warnBorder : colors.infoRing,
      }}
    >
      <Icon name={icon} color={warn ? colors.warnMuted : colors.info} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={warn ? colors.warnText : colors.infoText}>
          {title}
        </Text>
        {body ? <Text color={warn ? colors.warnMuted : colors.info}>{body}</Text> : null}
      </View>
    </View>
  );
}
