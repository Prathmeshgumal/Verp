import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidTimeZone, type SettingsDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { NumberField, SelectField, TextField } from '../components/Field';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Notice, PageLoader } from '../components/PageState';
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
      toast.success('Settings saved');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Rules that apply to every site and every worker." />
      <Panel className="max-w-2xl">
        <form
          noValidate
          className="divide-y"
          onSubmit={form.onSubmit((values) => {
            setError(null);
            save.mutate(schema.parse(values));
          })}
        >
          <Section title="Time" hint="How days are split and when reminders go out.">
            <SelectField label="Time zone" description="Work days and every time shown use this zone." data={zoneOptions} {...form.getInputProps('timezone')} />
            <TextField
              type="time"
              label="Check-out reminder time"
              description="Workers still checked in get a reminder on their phone at this time."
              inputClassName="ve-num w-40"
              {...form.getInputProps('reminderTime')}
            />
          </Section>
          <Section title="Location checks" hint="How strict check-ins are about where the phone is.">
            <NumberField
              label="Required GPS accuracy (metres)"
              description="A check-in with a less accurate location is refused. Lower is stricter."
              {...form.getInputProps('maxAccuracyM')}
            />
            <NumberField label="Default allowed distance for new sites (metres)" {...form.getInputProps('defaultRadiusM')} />
            <NumberField
              label="Phone clock warning (minutes)"
              description="Flag a day when the phone's clock is off by more than this."
              {...form.getInputProps('clockMismatchMinutes')}
            />
          </Section>
          <div className="flex items-center justify-end gap-3 px-5 py-4">
            {error ? (
              <div className="mr-auto">
                <Notice>{error}</Notice>
              </div>
            ) : null}
            <Button type="submit" loading={save.isPending}>
              Save settings
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 px-5 py-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">{hint}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}
