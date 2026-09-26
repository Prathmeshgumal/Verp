import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

interface Props {
  children: ReactNode;
  background?: string;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background = colors.bg, edges = ['top'], style }: Props) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: background }, style]}>
      {children}
    </SafeAreaView>
  );
}
