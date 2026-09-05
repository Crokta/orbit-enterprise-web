import { cn } from './cn'

/**
 * A filter chip: "All", "Policy breaches", "Suspended".
 *
 * A radio group in behaviour — exactly one is selected — but drawn as chips because a row
 * of radio buttons above a table reads as a form, and this is a view control.
 */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string; readonly count?: number | undefined }[]
  readonly onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => { onChange(option.value); }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              selected
                ? 'border-line-brand bg-brand-subtle text-fg-brand'
                : 'border-transparent bg-subtle text-fg-secondary hover:bg-hover hover:text-fg',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('tabular text-[11px]', selected ? 'text-fg-brand' : 'text-fg-tertiary')}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
