import { Alert, Button, Group, Paper, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import type { AdminDayDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../../lib/errors';
import { companyInputToIso, isoToCompanyInput } from '../../lib/time';
import { useServices } from '../../services';

interface Props {
  day: AdminDayDto;
  tz: string;
  onDone: () => void;
  onCancel: () => void;
}

export function FixCheckoutForm({ day, tz, onDone, onCancel }: Props) {
  const { api } = useServices();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      checkOutAt: day.checkOutAt ? isoToCompanyInput(day.checkOutAt, tz) : `${day.workDate}T18:00`,
      reason: '',
    },
    validate: zod4Resolver(
      z.object({
        checkOutAt: z.string().refine((value) => companyInputToIso(value, tz) !== null, 'Enter the date and time'),
        reason: z.string().trim().min(3, 'Say why, in a few words').max(500, 'Keep it under 500 characters'),
      }),
    ),
  });
  const fix = useMutation({
    mutationFn: (values: { checkOutAt: string; reason: string }) =>
      // The schema above has checked that the time parses.
      api.fixCheckout(day.id, { checkOutAt: companyInputToIso(values.checkOutAt, tz)!, reason: values.reason.trim() }),
    onSuccess: () => {
      notifications.show({ color: 'ledgerGreen', message: 'Check-out fixed' });
      onDone();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Paper withBorder p="md" radius="md">
      <form
        noValidate
        onSubmit={form.onSubmit((values) => {
          setError(null);
          fix.mutate(values);
        })}
      >
        <Stack>
          <TextInput
            type="datetime-local"
            label="Check-out time"
            description={`Company time (${tz})`}
            min={`${day.workDate}T00:00`}
            max={`${day.workDate}T23:59`}
            {...form.getInputProps('checkOutAt')}
          />
          <Textarea label="Reason" placeholder="e.g. Supervisor confirmed they left at 6 pm" autosize minRows={2} {...form.getInputProps('reason')} />
          {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={fix.isPending}>
              Save check-out
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
