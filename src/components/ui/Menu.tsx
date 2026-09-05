import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Icon } from './Icon'
import { cn } from './cn'

export interface MenuItem {
  readonly label: string
  readonly onSelect: () => void
  readonly tone?: 'neutral' | 'danger'
  readonly disabled?: boolean
}

/**
 * The row-level "⋮" menu.
 *
 * A button that opens a small list of actions. Closes on Escape, on a click outside and
 * after any choice — the three ways people expect a menu to go away.
 */
export function Menu({
  items,
  label = 'More actions',
  trigger,
  align = 'right',
}: {
  readonly items: readonly MenuItem[]
  readonly label?: string
  readonly trigger?: ReactNode
  readonly align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className={cn(
          'grid size-8 place-items-center rounded-md text-fg-tertiary transition-colors hover:bg-hover hover:text-fg',
          open && 'bg-hover text-fg',
        )}
      >
        {trigger ?? <Icon name="more" />}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-20 mt-1 min-w-[180px] rounded-lg border border-line-subtle bg-overlay p-1 shadow-[var(--shadow-e3)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-fg-disabled',
                item.tone === 'danger' ? 'text-fg-danger' : 'text-fg',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
