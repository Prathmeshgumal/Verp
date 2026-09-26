import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme/tokens';

const variants = {
  display: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 42 },
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 20 },
  monoLarge: { fontFamily: fonts.monoSemi, fontSize: 26, lineHeight: 32 },
  monoHuge: { fontFamily: fonts.monoSemi, fontSize: 44, lineHeight: 52 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof variants;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({ variant = 'body', color = colors.text, style, ...rest }: Props) {
  return <RNText maxFontSizeMultiplier={1.3} style={[variants[variant], { color }, style]} {...rest} />;
}
