import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { PageLoader } from '../components/PageState';
import { errorMessage } from '../lib/errors';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export function LoginPage() {
  const { state, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({ initialValues: { email: '', password: '' }, validate: zod4Resolver(schema) });

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'loggedIn') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const submit = form.onSubmit(async ({ email, password }) => {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder radius="lg" p="xl" w={380} maw="100%">
        <form onSubmit={submit} noValidate>
          <Stack>
            <div>
              <Title order={1}>VE HR</Title>
              <Text c="dimmed">Admin login</Text>
            </div>
            {state.notice ? <Alert color="ledgerBlue">{state.notice}</Alert> : null}
            {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
            <TextInput label="Email" type="email" autoComplete="username" {...form.getInputProps('email')} />
            <PasswordInput label="Password" autoComplete="current-password" {...form.getInputProps('password')} />
            <Button type="submit" size="md" loading={busy}>
              Log in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
