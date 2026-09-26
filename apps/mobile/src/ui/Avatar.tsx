import React from 'react';
import { View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function Avatar({ name }: { name: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15 }}>{initials(name)}</Text>
    </View>
  );
}
