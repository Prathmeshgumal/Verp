import { NativeSelect, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { normalizePhone, type EmployeeCreate, type EmployeeDto, type EmployeeUpdate, type SiteDto } from '@ve/shared';
import { z } from 'zod';

// A type, not an interface: the zod form resolver needs values assignable to Record<string, unknown>.
export type EmployeeFormValues = {
  name: string;
  phone: string;
  employeeCode: string;
  /** '' = no site. */
  siteId: string;
};

export const emptyEmployeeForm: EmployeeFormValues = { name: '', phone: '', employeeCode: '', siteId: '' };

export const employeeFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(120, 'Name is too long'),
  phone: z.string().refine((value) => normalizePhone(value) !== null, 'Enter a 10-digit mobile number'),
  employeeCode: z.string().trim().max(32, 'Code is too long'),
  siteId: z.string(),
});

// normalizePhone cannot return null here: the schema above has already checked the phone.
export function toEmployeeCreate(v: EmployeeFormValues): EmployeeCreate {
  return { name: v.name.trim(), phone: normalizePhone(v.phone)!, employeeCode: v.employeeCode.trim() || undefined, siteId: v.siteId || null };
}

export function toEmployeeUpdate(v: EmployeeFormValues): EmployeeUpdate {
  return { name: v.name.trim(), phone: normalizePhone(v.phone)!, employeeCode: v.employeeCode.trim() || null, siteId: v.siteId || null };
}

export function employeeToForm(e: EmployeeDto): EmployeeFormValues {
  return { name: e.name, phone: e.phone, employeeCode: e.employeeCode ?? '', siteId: e.siteId ?? '' };
}

export function EmployeeFields({ form, sites }: { form: UseFormReturnType<EmployeeFormValues>; sites: SiteDto[] }) {
  // Inactive sites are hidden, except the one this employee is already on.
  const siteOptions = [
    { value: '', label: 'No site yet' },
    ...sites
      .filter((s) => s.isActive || s.id === form.values.siteId)
      .map((s) => ({ value: s.id, label: s.isActive ? s.name : `${s.name} (inactive)` })),
  ];
  return (
    <>
      <TextInput label="Name" {...form.getInputProps('name')} />
      <TextInput label="Mobile number" description="10 digits. The worker logs in with this." type="tel" {...form.getInputProps('phone')} />
      <TextInput label="Employee code (optional)" {...form.getInputProps('employeeCode')} />
      <NativeSelect label="Site" data={siteOptions} {...form.getInputProps('siteId')} />
    </>
  );
}
