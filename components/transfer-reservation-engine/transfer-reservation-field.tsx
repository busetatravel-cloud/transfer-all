import type { ReactNode } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

type FieldProps = BaseProps & {
  children: ReactNode;
};

export function FormField({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
  );
}

type CounterProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
};

export function CounterField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  min = 0,
  max = 99,
}: CounterProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        min={min}
        max={max}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

type TextFieldProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

export function TextField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
}: TextFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

type TextAreaProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export function TextAreaField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  placeholder,
  rows = 4,
}: TextAreaProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      <textarea
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

type CheckboxCardProps = BaseProps & {
  checked: boolean;
  onChange: (value: boolean) => void;
  description: string;
};

export function CheckboxCard({
  label,
  hint,
  error,
  required,
  checked,
  onChange,
  description,
}: CheckboxCardProps) {
  return (
    <button
      className={`grid gap-2 rounded-[24px] border px-4 py-4 text-left transition ${
        checked
          ? "border-slate-900 bg-slate-950 text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)]"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
      }`}
      type="button"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          {label}
          {required ? <span className="ml-1 text-rose-400">*</span> : null}
        </div>
        <div
          className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold ${
            checked
              ? "border-white/70 bg-white text-slate-950"
              : "border-slate-300 bg-white text-transparent"
          }`}
        >
          ✓
        </div>
      </div>
      <div className={`text-sm leading-6 ${checked ? "text-slate-200" : "text-slate-500"}`}>
        {description}
      </div>
      {hint ? (
        <div className={`text-xs ${checked ? "text-slate-300" : "text-slate-400"}`}>{hint}</div>
      ) : null}
      {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}
    </button>
  );
}

type SelectFieldProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
};

export function SelectField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
