import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props extends BottomTabBarProps {
  items: Record<string, { icon: IconName; labelKey: string }>;
  height: number;
}

export function TabBar({ state, navigation, items, height }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.surface,
        paddingBottom: insets.bottom,
      }}
    >
      {state.routes.map((route, index) => {
        const item = items[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const color = focused ? colors.text : colors.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(item.labelKey)}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, height, alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Icon name={item.icon} size={26} color={color} />
            <Text
              color={color}
              style={{ fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium, fontSize: height >= 76 ? 15 : 13 }}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
