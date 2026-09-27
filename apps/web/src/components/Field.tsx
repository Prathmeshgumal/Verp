import { useEffect, useId, useState, type ChangeEvent, type ComponentProps, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { CalendarIcon } from 'lucide-react';

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

/** Radix Select cannot hold an empty value, so "" (e.g. "All sites") travels as this stand-in. */
const EMPTY = '__empty__';

interface SelectFieldProps extends FieldFrame {
  data: Option[];
  value?: string;
  /** Takes the new value; @mantine/form's getInputProps onChange accepts that too. */
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({ label, description, error, className, data, value = '', onChange, onBlur, placeholder, disabled }: SelectFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const options = data.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const selected = options.find((o) => o.value === value);
  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <Select
        value={value === '' ? EMPTY : value}
        onValueChange={(v) => onChange(v === EMPTY ? '' : v)}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, description, error)}>
          <SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Radix mounts every item even while closed; with ~400 time zones that froze page switches. */}
          {(open ? options : selected ? [selected] : []).map((o) => (
            <SelectItem key={o.value} value={o.value === '' ? EMPTY : o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Frame>
  );
}

interface DateFieldProps extends FieldFrame {
  /** YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
}

/** A button showing the date that opens a calendar. */
export function DateField({ label, description, error, className, value, onChange }: DateFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const date = value ? dayjs(value, 'YYYY-MM-DD') : null;
  return (
    <Frame id={id} label={label} description={description} error={error} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, description, error)}
          className={cn(
            'border-input bg-card hover:bg-accent/40 flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm shadow-xs outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] data-[state=open]:border-ring data-[state=open]:ring-ring/25 data-[state=open]:ring-[3px]',
          )}
        >
          <CalendarIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <span className={cn('ve-num truncate', !date && 'text-muted-foreground')}>{date ? date.format('D MMM YYYY') : 'Pick a date'}</span>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={date?.toDate()}
            defaultMonth={date?.toDate()}
            onSelect={(d) => {
              if (!d) return;
              onChange(dayjs(d).format('YYYY-MM-DD'));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
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
