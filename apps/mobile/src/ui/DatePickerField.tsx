import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, formatMonthYear, formatWorkDateMedium } from '../attendance/format';
import { monthOf, shiftMonth } from '../attendance/history';
import { colors, fonts, radius } from '../theme/tokens';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface Props {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  /** Latest day that can be picked (YYYY-MM-DD). */
  max?: string;
}

/** A button showing the date; tapping it opens a month calendar in a sheet. Weeks start on Monday. */
export function DatePickerField({ label, value, onChange, max }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  const letters = t('date.weekdaysShort').split(',');

  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text variant="label">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatWorkDateMedium(value, t)}`}
        onPress={() => {
          setMonth(monthOf(value));
          setOpen(true);
        }}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, backgroundColor: colors.surface }}
      >
        <Icon name="calendar" size={18} color={colors.muted} />
        <Text variant="mono" numberOfLines={1}>
          {formatWorkDateMedium(value, t)}
        </Text>
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('history.previousMonth')} onPress={() => setMonth(shiftMonth(month, -1))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
          <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
            {formatMonthYear(month, t)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('history.nextMonth')} onPress={() => setMonth(shiftMonth(month, 1))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronRight" size={22} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5, 6, 0].map((i) => (
            <Text key={i} variant="small" color={colors.muted} style={{ flex: 1, textAlign: 'center' }}>
              {(letters[i] ?? '').slice(0, 2)}
            </Text>
          ))}
        </View>
        {Array.from({ length: days.length / 7 }, (_, w) => (
          <View key={w} style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {days.slice(w * 7, w * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
              const selected = d === value;
              const disabled = !!max && d > max;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={formatWorkDateMedium(d, t)}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    setOpen(false);
                    onChange(d);
                  }}
                  style={{ flex: 1, aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.dark : 'transparent', opacity: disabled ? 0.3 : 1 }}
                >
                  <Text style={{ fontFamily: selected ? fonts.monoSemi : fonts.mono, fontSize: 16 }} color={selected ? colors.onDark : colors.text}>
                    {String(Number(d.slice(8)))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Sheet>
    </View>
  );
}
