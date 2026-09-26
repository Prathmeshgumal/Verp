import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radius, TOUCH_MIN } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'checkIn' | 'checkOut' | 'link';
type Size = 'big' | 'large' | 'normal' | 'small';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
}

const palette: Record<Variant, { bg: string; fg: string; shadow?: string; border?: string }> = {
  primary: { bg: colors.dark, fg: colors.white },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.inputBorder },
  checkIn: { bg: colors.checkIn, fg: colors.white, shadow: colors.checkInShadow },
  checkOut: { bg: colors.checkOut, fg: colors.white, shadow: colors.checkOutShadow },
  link: { bg: 'transparent', fg: colors.info },
};

const heights: Record<Size, number> = { big: 150, large: 72, normal: 60, small: 48 };

export function Button({ label, onPress, variant = 'primary', size = 'normal', icon, disabled, testID }: Props) {
  const p = palette[variant];
  const big = size === 'big';
  const height = heights[size];
  return (
    <View style={[p.shadow && !disabled ? { backgroundColor: p.shadow, borderRadius: radius.xl, paddingBottom: 6 } : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: Math.max(height, size === 'small' ? 48 : TOUCH_MIN),
            backgroundColor: p.bg,
            borderRadius: big ? radius.xl : radius.lg,
            flexDirection: big ? 'column' : 'row',
            opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          },
          p.border ? { borderWidth: 1, borderColor: p.border } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={big ? 40 : 22} color={p.fg} strokeWidth={big ? 2.2 : 2} /> : null}
        <Text
          color={p.fg}
          style={{
            fontFamily: big || size === 'large' ? fonts.heading : fonts.bodyBold,
            fontSize: big ? 30 : size === 'large' ? 24 : size === 'small' ? 15 : 18,
            letterSpacing: big ? 0.6 : 0,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
});
