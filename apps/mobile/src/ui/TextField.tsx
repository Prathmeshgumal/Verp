import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          {
            minHeight: 52,
            borderWidth: 1,
            borderColor: error ? colors.checkOut : colors.inputBorder,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="small" color={colors.checkOut}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
