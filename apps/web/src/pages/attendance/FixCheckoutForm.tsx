import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import type { AdminDayDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TextareaField, TextField } from '../../components/Field';
import { Notice } from '../../components/PageState';
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
      toast.success('Check-out fixed');
      onDone();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <form
      noValidate
      className="bg-muted/40 grid gap-4 rounded-xl border p-4"
      onSubmit={form.onSubmit((values) => {
        setError(null);
        fix.mutate(values);
      })}
    >
      <TextField
        type="datetime-local"
        label="Check-out time"
        description={`Company time (${tz})`}
        min={`${day.workDate}T00:00`}
        max={`${day.workDate}T23:59`}
        inputClassName="ve-num"
        {...form.getInputProps('checkOutAt')}
      />
      <TextareaField label="Reason" placeholder="e.g. Supervisor confirmed they left at 6 pm" rows={2} {...form.getInputProps('reason')} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={fix.isPending}>
          Save check-out
        </Button>
      </div>
    </form>
  );
}
