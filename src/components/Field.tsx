"use client";

type Props = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 14,
}: Props) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs tabular-nums text-muted">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </span>
      {hint ? <span className="-mt-1 text-xs text-muted">{hint}</span> : null}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-white p-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}
