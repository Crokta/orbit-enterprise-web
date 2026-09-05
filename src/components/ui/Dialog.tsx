import { type ReactNode, useEffect, useRef } from 'react'

import { Icon } from './Icon'
import { cn } from './cn'

/**
 * A modal, on the native `<dialog>` element.
 *
 * The browser gives us the overlay, focus containment, Escape to close and inert content
 * behind — every one of which a hand-rolled modal gets subtly wrong. What is left to do
 * here is open it when asked and report when the user closed it.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly subtitle?: string | undefined
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly size?: 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = ref.current

    if (element === null) {
      return
    }

    if (open && !element.open) {
      element.showModal()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself; a click inside
        // lands on a child. Only the former closes it.
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-line-subtle bg-surface p-0 text-fg shadow-[var(--shadow-e3)]',
        'backdrop:bg-[rgb(2_6_23/0.6)] open:animate-[dialog-in_160ms_ease-out]',
        size === 'md' ? 'max-w-[560px]' : 'max-w-[600px]',
      )}
    >
      {open && (
        <div className="p-8">
          <header className="mb-6 flex items-start justify-between gap-6">
            <div>
              <h2 id="dialog-title" className="text-[20px] font-semibold leading-[26px]">{title}</h2>
              {subtitle !== undefined && <p className="mt-1 text-[14px] text-fg-secondary">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-2 grid size-8 place-items-center rounded-md text-fg-tertiary hover:bg-hover hover:text-fg"
            >
              <Icon name="close" />
            </button>
          </header>

          <div className="space-y-5">{children}</div>

          {footer !== undefined && <footer className="mt-7 flex items-center gap-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
