import { Alert, Button, Group, NativeSelect, NumberInput, Paper, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidTimeZone, type SettingsDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { PageLoader } from '../components/PageState';
import { errorMessage } from '../lib/errors';
import { queryKeys } from '../lib/queryKeys';
import { useCompanySettings } from '../lib/useCompanySettings';
import { useServices } from '../services';

// Same limits as settingsUpdateSchema in @ve/shared, with messages an admin can act on.
const schema = z.object({
  timezone: z.string().refine(isValidTimeZone, 'Pick a time zone'),
  maxAccuracyM: z.number({ error: 'Enter a number' }).int('Use whole metres').min(5, 'At least 5 m').max(500, 'At most 500 m'),
  defaultRadiusM: z.number({ error: 'Enter a number' }).int('Use whole metres').min(10, 'At least 10 m').max(1000, 'At most 1000 m'),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 19:00'),
  clockMismatchMinutes: z.number({ error: 'Enter a number' }).int('Use whole minutes').min(1, 'At least 1 minute').max(120, 'At most 120 minutes'),
});

type FormValues = {
  timezone: string;
  reminderTime: string;
  /** NumberInput gives '' while the box is empty. */
  maxAccuracyM: number | string;
  defaultRadiusM: number | string;
  clockMismatchMinutes: number | string;
};

export function SettingsPage() {
  const settings = useCompanySettings();
  if (!settings.data) return <PageLoader />;
  return <SettingsForm key={settings.dataUpdatedAt} settings={settings.data} />;
}

function SettingsForm({ settings }: { settings: SettingsDto }) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ initialValues: settings, validate: zod4Resolver(schema) });
  const zones = Intl.supportedValuesOf('timeZone');
  const zoneOptions = zones.includes(settings.timezone) ? zones : [settings.timezone, ...zones];

  const save = useMutation({
    mutationFn: (values: z.output<typeof schema>) => api.updateSettings(values),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings, updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      notifications.show({ color: 'ledgerGreen', message: 'Settings saved' });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>Settings</Title>
      <Paper withBorder p="md" radius="md">
        <form
          noValidate
          onSubmit={form.onSubmit((values) => {
            setError(null);
            save.mutate(schema.parse(values));
          })}
        >
          <Stack>
            <NativeSelect label="Time zone" description="Work days and every time shown use this zone." data={zoneOptions} {...form.getInputProps('timezone')} />
            <NumberInput
              label="Required GPS accuracy (metres)"
              description="A check-in with a less accurate location is refused. Lower is stricter."
              allowDecimal={false}
              clampBehavior="none"
              {...form.getInputProps('maxAccuracyM')}
            />
            <NumberInput
              label="Default allowed distance for new sites (metres)"
              allowDecimal={false}
              clampBehavior="none"
              {...form.getInputProps('defaultRadiusM')}
            />
            <TextInput
              type="time"
              label="Check-out reminder time"
              description="Workers still checked in get a reminder on their phone at this time."
              {...form.getInputProps('reminderTime')}
            />
            <NumberInput
              label="Phone clock warning (minutes)"
              description="Flag a day when the phone's clock is off by more than this."
              allowDecimal={false}
              clampBehavior="none"
              {...form.getInputProps('clockMismatchMinutes')}
            />
            {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending}>
                Save settings
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
