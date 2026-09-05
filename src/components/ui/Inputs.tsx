import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef, useId } from 'react'

import { Icon } from './Icon'
import { cn } from './cn'

/** Label, control, hint and error, stacked the way every form in the design stacks them. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  readonly label: string
  readonly hint?: ReactNode
  readonly error?: string | undefined
  readonly htmlFor?: string
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {error !== undefined ? (
        <p role="alert" className="text-[12px] text-fg-danger">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-[12px] text-fg-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-fg placeholder:text-fg-tertiary ' +
  'transition-colors focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-[color:var(--border-focus)]/30 ' +
  'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, className)} {...rest} />
})

/** A text input with a leading currency symbol or unit. */
export function PrefixedInput({
  prefix,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { readonly prefix: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-fg-secondary">
        {prefix}
      </span>
      <input className={cn(CONTROL, 'pl-8', className)} {...rest} />
    </div>
  )
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, 'appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3 top-3 text-fg-tertiary" />
    </div>
  )
}

/** The search box that heads every list: icon, placeholder, nothing else. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder: string
  readonly className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-2.5 text-fg-tertiary" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => { onChange(event.target.value); }}
        className={cn(CONTROL, 'h-10 pl-10')}
      />
    </div>
  )
}

/** A checkbox with a title and a one-line explanation, as every dialog in the design has. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'neutral',
}: {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
  readonly tone?: 'neutral' | 'warning'
}) {
  const id = useId()

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => { onChange(event.target.checked); }}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[4px] border-line accent-[var(--bg-brand)] disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className={cn('cursor-pointer select-none', disabled === true && 'cursor-not-allowed opacity-60')}>
        <span className="block text-[14px] font-medium leading-5 text-fg">{label}</span>
        {description !== undefined && (
          <span className={cn('block text-[12px] leading-4', tone === 'warning' ? 'text-fg-warning' : 'text-fg-tertiary')}>
            {description}
          </span>
        )}
      </label>
    </div>
  )
}

/** A switch. On or off, with the label to its right. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  trailing,
}: {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
  readonly description?: ReactNode
  readonly disabled?: boolean
  /** A control shown at the right edge: an input, an "Edit" link. */
  readonly trailing?: ReactNode
}) {
  const id = useId()

  return (
    <div className="flex items-center gap-4 py-4">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => { onChange(!checked); }}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)]/40',
          checked ? 'bg-brand' : 'bg-pressed',
          disabled === true && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow-[var(--shadow-e1)] transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>

      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn('block text-[15px] font-medium leading-5', checked ? 'text-fg' : 'text-fg-secondary')}>
          {label}
        </label>
        {description !== undefined && <p className="text-[12px] text-fg-tertiary">{description}</p>}
      </div>

      {trailing}
    </div>
  )
}

/** A radio drawn as a card: environment, role. One is always selected. */
export function RadioCards<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 1,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string; readonly description: string }[]
  readonly onChange: (value: T) => void
  readonly columns?: 1 | 2 | 3
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}
    >
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
              'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
              selected ? 'border-line-brand bg-brand-subtle' : 'border-line bg-surface hover:bg-hover',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2',
                selected ? 'border-[var(--bg-brand)]' : 'border-line-strong',
              )}
            >
              {selected && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span>
              <span className={cn('block text-[15px] font-medium leading-5', selected ? 'text-fg-brand' : 'text-fg')}>
                {option.label}
              </span>
              <span className="block text-[12px] leading-4 text-fg-tertiary">{option.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Segmented choice: "Myself · A colleague · A visitor". */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string; readonly disabled?: boolean }[]
  readonly onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => { onChange(option.value); }}
            className={cn(
              'h-10 rounded-md border px-3 text-left text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'border-line-brand bg-brand-subtle text-fg-brand' : 'border-line bg-surface text-fg hover:bg-hover',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
