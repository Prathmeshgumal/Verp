import React, { useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { normalizePhone } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { loginErrorKey, lostReasonKey } from '../../auth/loginErrors';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, radius, TOUCH_MIN } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<AuthStackParamList, 'WorkerLogin'>;

const PIN_LENGTH = 6;

export function WorkerLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { state, loginEmployee } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [errorKey, setErrorKey] = useState<string | null>(
    state.status === 'loggedOut' ? lostReasonKey(state.reason) : null,
  );

  async function submit(fullPin: string) {
    if (!normalizePhone(phone)) {
      setErrorKey('login.errors.invalidPhone');
      setPin('');
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      await loginEmployee(phone, fullPin);
    } catch (err) {
      setErrorKey(loginErrorKey(err, 'worker'));
      setPin('');
      pinRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function onPinChange(text: string) {
    if (busy) return;
    const next = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 40, gap: 20, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: colors.dark,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text color={colors.onDark} style={{ fontFamily: fonts.heading, fontSize: 16 }}>
              VE
            </Text>
          </View>
          <Text variant="h2" style={{ fontSize: 22 }}>
            {t('app.name')}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="h1" style={{ fontSize: 32 }}>
            {t('login.title')}
          </Text>
          <Text color={colors.muted}>{t('login.subtitle')}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('login.phone')}</Text>
          <TextInput
            accessibilityLabel={t('login.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            autoFocus={!phone}
            returnKeyType="next"
            onSubmitEditing={() => pinRef.current?.focus()}
            submitBehavior="submit"
            maxLength={16}
            editable={!busy}
            style={{
              height: TOUCH_MIN,
              borderWidth: 2,
              borderColor: colors.dark,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              backgroundColor: colors.surface,
              color: colors.text,
              fontFamily: fonts.monoSemi,
              fontSize: 24,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('login.pin')}</Text>
          <View>
            <View
              accessible
              accessibilityLabel={t('login.pinEntered', { n: pin.length })}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: radius.sm,
                    borderWidth: 2,
                    borderColor: i === pin.length ? colors.dark : colors.inputBorder,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i < pin.length ? (
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: colors.dark,
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
            {/* The real input: invisible, laid over the boxes, so a tap anywhere on them opens the phone's number keyboard. */}
            <TextInput
              ref={pinRef}
              accessibilityLabel={t('login.pin')}
              value={pin}
              onChangeText={onPinChange}
              keyboardType="number-pad"
              maxLength={PIN_LENGTH}
              secureTextEntry
              autoComplete="off"
              importantForAutofill="no"
              caretHidden
              contextMenuHidden
              editable={!busy}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                opacity: 0.02,
                color: 'transparent',
              }}
            />
          </View>
        </View>

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        {busy ? <Text color={colors.muted}>{t('login.busy')}</Text> : null}

        <View style={{ flexGrow: 1 }} />
        <Button
          label={t('login.adminLink')}
          variant="link"
          size="small"
          onPress={() => navigation.navigate('AdminLogin')}
        />
      </ScrollView>
    </Screen>
  );
}
