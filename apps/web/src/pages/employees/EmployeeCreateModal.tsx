import { Alert, Button, Group, Modal, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedEmployeeDto, SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
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
    <Modal opened={opened} onClose={close} title="Add employee">
      <form
        noValidate
        onSubmit={form.onSubmit((values) => {
          setError(null);
          create.mutate(values);
        })}
      >
        <Stack>
          <EmployeeFields form={form} sites={sites} />
          {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create employee
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
