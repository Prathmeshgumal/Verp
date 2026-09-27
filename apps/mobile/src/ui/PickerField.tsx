import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';
import { Icon } from './Icon';
import { Sheet, SheetOption } from './Sheet';
import { Text } from './Text';

export interface PickerOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  /** Hide the label above the button (e.g. in a row of filter chips). */
  compact?: boolean;
}

/** A button showing the current choice; tapping it lists the options in a sheet. */
export function PickerField({ label, value, options, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <View style={{ gap: 6 }}>
      {compact ? null : <Text variant="label">{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        onPress={() => setOpen(true)}
        style={{
          minHeight: compact ? 44 : 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: compact ? radius.pill : radius.md,
          backgroundColor: colors.surface,
        }}
      >
        <Text numberOfLines={1} style={{ flex: compact ? undefined : 1, fontFamily: compact ? fonts.bodySemi : fonts.body, fontSize: compact ? 14 : 16 }}>
          {current}
        </Text>
        <Icon name="chevronDown" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((o) => (
          <SheetOption
            key={o.value}
            label={o.label}
            selected={o.value === value}
            onPress={() => {
              setOpen(false);
              onChange(o.value);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}
