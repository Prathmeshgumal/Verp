import React, { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** The button that goes ahead, e.g. "Log out". */
  confirmLabel: string;
  icon?: IconName;
  /** danger = the action is hard to undo; the button turns red. */
  tone?: 'danger' | 'neutral';
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/** Ask before doing something: `if (await confirm({...})) doIt()`. Needs <ConfirmProvider> above. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('useConfirm needs a ConfirmProvider');
  return ask;
}

/** One app-styled dialog for every "are you sure?" question, instead of the plain system alert. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((yes: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((options) => {
    resolver.current?.(false);
    setOpen(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function answer(yes: boolean) {
    resolver.current?.(yes);
    resolver.current = null;
    setOpen(null);
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog options={open} onAnswer={answer} />
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions | null; onAnswer: (yes: boolean) => void }) {
  const { t } = useTranslation();
  const danger = (options?.tone ?? 'danger') === 'danger';
  const accent = danger ? colors.danger : colors.dark;
  return (
    <Modal visible={options !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => onAnswer(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Pressable accessibilityLabel={t('common.cancel')} onPress={() => onAnswer(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,23,26,0.5)' }} />
        {options ? (
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, gap: 16 }}>
            {options.icon ? (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: danger ? colors.dangerBg : colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={options.icon} size={22} color={accent} />
              </View>
            ) : null}
            <View style={{ gap: 6 }}>
              <Text variant="h2" accessibilityRole="header">
                {options.title}
              </Text>
              {options.body ? (
                <Text color={colors.muted} style={{ fontSize: 15, lineHeight: 21 }}>
                  {options.body}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DialogButton label={t('common.cancel')} onPress={() => onAnswer(false)} bg={colors.surface} fg={colors.text} border={colors.inputBorder} />
              <DialogButton label={options.confirmLabel} onPress={() => onAnswer(true)} bg={accent} fg={colors.white} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DialogButton({ label, onPress, bg, fg, border }: { label: string; onPress: () => void; bg: string; fg: string; border?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 50,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text color={fg} style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
