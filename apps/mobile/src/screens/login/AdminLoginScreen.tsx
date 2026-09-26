import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { loginErrorKey } from '../../auth/loginErrors';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';

type Props = NativeStackScreenProps<AuthStackParamList, 'AdminLogin'>;

export function AdminLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErrorKey(null);
    try {
      await loginAdmin(email, password);
    } catch (err) {
      setErrorKey(loginErrorKey(err, 'admin'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text variant="h1">{t('login.adminTitle')}</Text>
          <Text color={colors.muted}>{t('login.adminSubtitle')}</Text>
        </View>
        <TextField
          label={t('login.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
        />
        <TextField
          label={t('login.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!busy}
        />
        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button
          label={busy ? t('login.busy') : t('login.submit')}
          onPress={() => void submit()}
          disabled={busy || !email.trim() || !password}
        />
        <Button label={t('login.workerLink')} variant="link" size="small" onPress={() => navigation.goBack()} />
      </ScrollView>
    </Screen>
  );
}
