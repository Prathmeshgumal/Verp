import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedEmployeeDto, SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice } from '../../components/PageState';
import { PinModal } from '../../components/PinModal';
import { errorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { useServices } from '../../services';
import { EmployeeFields, emptyEmployeeForm, employeeFormSchema, toEmployeeCreate, type EmployeeFormValues } from './employeeForm';

export function EmployeeCreateModal({ opened, onClose, sites }: { opened: boolean; onClose: () => void; sites: SiteDto[] }) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<CreatedEmployeeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmployeeFormValues>({ initialValues: emptyEmployeeForm, validate: zod4Resolver(employeeFormSchema) });
  const create = useMutation({
    mutationFn: (values: EmployeeFormValues) => api.createEmployee(toEmployeeCreate(values)),
    onSuccess: (result) => {
      setCreated(result);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function close() {
    form.reset();
    setCreated(null);
    setError(null);
    create.reset();
    onClose();
  }

  if (created) return <PinModal opened={opened} name={created.employee.name} pin={created.pin} onClose={close} />;

  return (
    <Dialog open={opened} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>They log in on the phone app with their mobile number and a PIN.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.onSubmit((values) => {
            setError(null);
            create.mutate(values);
          })}
        >
          <EmployeeFields form={form} sites={sites} />
          {error ? <Notice>{error}</Notice> : null}
          <DialogFooter className="mt-2">
            <Button variant="outline" type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
