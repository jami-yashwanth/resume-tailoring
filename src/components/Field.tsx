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
        <span className="text-xs tabular-nums text-ink-muted">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </span>
      {hint ? <span className="-mt-1 text-xs text-ink-muted">{hint}</span> : null}
      {/* Focus is the global outline ring, not a border+ring recolour: the
          brand book asks for one focus treatment everywhere. */}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-line-strong bg-paper-raised p-3 font-mark text-[13px] leading-relaxed text-ink placeholder:text-ink-muted"
      />
    </label>
  );
}
