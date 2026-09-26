import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { TextField } from '../components/Field';
import { Notice, PageLoader } from '../components/PageState';
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
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-[380px] max-w-full">
        <div className="mb-8 flex items-center gap-2.5">
          <span aria-hidden className="bg-brand grid size-9 place-items-center rounded-xl text-sm font-bold text-white">
            VE
          </span>
          <div>
            <h1 className="text-xl leading-tight font-bold">VE HR</h1>
            <p className="text-muted-foreground text-sm">Admin login</p>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="bg-card grid gap-4 rounded-2xl border p-6 shadow-xs">
          {state.notice ? <Notice tone="info">{state.notice}</Notice> : null}
          {error ? <Notice>{error}</Notice> : null}
          <TextField label="Email" type="email" autoComplete="username" {...form.getInputProps('email')} />
          <TextField label="Password" type="password" autoComplete="current-password" {...form.getInputProps('password')} />
          <Button type="submit" size="lg" className="mt-1" loading={busy}>
            Log in
          </Button>
        </form>
      </div>
    </div>
  );
}
