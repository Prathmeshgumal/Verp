import { Alert, Button, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EmployeeDto, SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { errorMessage } from '../../lib/errors';
import { useServices } from '../../services';
import { EmployeeFields, employeeFormSchema, employeeToForm, toEmployeeUpdate, type EmployeeFormValues } from './employeeForm';

/** Mount with key={employee.id} so a different employee starts a fresh form. */
export function EmployeeEditForm({ employee, sites }: { employee: EmployeeDto; sites: SiteDto[] }) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmployeeFormValues>({ initialValues: employeeToForm(employee), validate: zod4Resolver(employeeFormSchema) });
  const save = useMutation({
    mutationFn: (values: EmployeeFormValues) => api.updateEmployee(employee.id, toEmployeeUpdate(values)),
    onSuccess: (updated) => {
      form.setValues(employeeToForm(updated));
      form.resetDirty(employeeToForm(updated));
      notifications.show({ color: 'ledgerGreen', message: 'Saved' });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) => {
        setError(null);
        save.mutate(values);
      })}
    >
      <Stack>
        <EmployeeFields form={form} sites={sites} />
        {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending} disabled={!form.isDirty()}>
            Save changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
