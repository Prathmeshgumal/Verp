import { useEffect, useId, useState, type ChangeEvent, type ComponentProps, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FieldFrame {
  label: ReactNode;
  description?: ReactNode;
  /** A validation message; @mantine/form's getInputProps passes it straight in. */
  error?: ReactNode;
  className?: string;
}

/** Label, optional hint, the control, and its error, wired together for screen readers. */
function Frame({ id, label, description, error, className, children }: FieldFrame & { id: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {description ? (
        <p id={`${id}-desc`} className="text-muted-foreground -mt-0.5 text-xs leading-snug">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, description: ReactNode, error: ReactNode): string | undefined {
  const ids = [description ? `${id}-desc` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type InputFieldProps = FieldFrame & Omit<ComponentProps<typeof Input>, 'className'> & { leftSection?: ReactNode; inputClassName?: string };

export function TextField({ label, description, error, className, leftSection, inputClassName, ...props }: InputFieldProps) {
  const id = useId();
  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <div className="relative">
        {leftSection ? <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 [&_svg]:size-4">{leftSection}</span> : null}
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, description, error)}
          className={cn(leftSection ? 'pl-9' : undefined, inputClassName)}
          {...props}
        />
      </div>
    </Frame>
  );
}

type NumberValue = number | string;

function formatNumber(value: NumberValue, decimalScale?: number): string {
  if (typeof value !== 'number') return value;
  return String(decimalScale == null ? value : Number(value.toFixed(decimalScale)));
}

function parseNumber(text: string): NumberValue {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(trimmed) ? Number(trimmed) : text;
}

type NumberFieldProps = FieldFrame &
  Omit<ComponentProps<typeof Input>, 'className' | 'value' | 'onChange' | 'type'> & {
    value?: NumberValue;
    /** Gets a number, '' while empty, or the raw text when it is not a number (the form's schema then complains). */
    onChange: (value: NumberValue) => void;
    decimalScale?: number;
  };

/** A number box that keeps what the admin types (e.g. "17.") while handing the form a real number. */
export function NumberField({ label, description, error, className, value = '', onChange, decimalScale, ...props }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => formatNumber(value, decimalScale));

  useEffect(() => {
    // Follow outside changes (e.g. the map moved the pin), but not the echo of our own typing.
    setText((current) => (parseNumber(current) === value ? current : formatNumber(value, decimalScale)));
  }, [value, decimalScale]);

  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <Input
        id={id}
        inputMode="decimal"
        className="ve-num"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, description, error)}
        value={text}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setText(event.currentTarget.value);
          onChange(parseNumber(event.currentTarget.value));
        }}
        {...props}
      />
    </Frame>
  );
}

type Option = string | { value: string; label: string };

type SelectFieldProps = FieldFrame & Omit<ComponentProps<'select'>, 'className'> & { data: Option[] };

export function SelectField({ label, description, error, className, data, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <NativeSelect id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, description, error)} {...props}>
        {data.map((option) => {
          const { value, label: text } = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </NativeSelect>
    </Frame>
  );
}

type TextareaFieldProps = FieldFrame & Omit<ComponentProps<typeof Textarea>, 'className'>;

export function TextareaField({ label, description, error, className, ...props }: TextareaFieldProps) {
  const id = useId();
  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <Textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, description, error)} {...props} />
    </Frame>
  );
}

interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  /** Takes the new value; @mantine/form's checkbox input props accept that too. */
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function SwitchField({ label, checked, onChange, className, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-muted-foreground font-normal">
        {label}
      </Label>
    </div>
  );
}

export function CheckboxField({ label, checked, onChange, className, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
