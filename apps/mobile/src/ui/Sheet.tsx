import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, radius } from '../theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

/** A panel that slides up from the bottom, with a title and a close button. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(23,23,26,0.45)' }} />
      <View style={{ maxHeight: '80%', backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 12 }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingVertical: 4 }}>
          <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 4 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SheetOption({ label, detail, selected, onPress }: { label: string; detail?: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        borderRadius: radius.md,
        backgroundColor: selected ? colors.surface : pressed ? colors.lineSoft : 'transparent',
        borderWidth: selected ? 1 : 0,
        borderColor: colors.line,
      })}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant={selected ? 'bodyStrong' : 'body'} style={{ fontSize: 16 }}>
          {label}
        </Text>
        {detail ? (
          <Text variant="small" color={colors.muted}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color={colors.checkOut} /> : null}
    </Pressable>
  );
}
