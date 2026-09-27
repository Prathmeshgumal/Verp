import React, { useState } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * A ScrollView whose content fades out at the top edge once it has been scrolled,
 * instead of being cut off sharply under whatever sits above it (e.g. a map).
 */
export function FadedScrollView({ fadeColor = colors.bg, onScroll, ...props }: ScrollViewProps & { fadeColor?: string }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        {...props}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 2;
          if (next !== scrolled) setScrolled(next);
          onScroll?.(event);
        }}
      />
      {scrolled ? (
        <View testID="scroll-fade" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28 }}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fadeColor} stopOpacity={1} />
                <Stop offset="1" stopColor={fadeColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#fade)" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
