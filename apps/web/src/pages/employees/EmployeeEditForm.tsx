import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EmployeeDto, SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Notice } from '../../components/PageState';
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
      toast.success('Saved');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.onSubmit((values) => {
        setError(null);
        save.mutate(values);
      })}
    >
      <EmployeeFields form={form} sites={sites} />
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!form.isDirty()}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
