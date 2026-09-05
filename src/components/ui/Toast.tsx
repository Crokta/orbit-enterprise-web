import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react'

import { Icon } from './Icon'
import { cn } from './cn'

interface Toast {
  readonly id: number
  readonly message: string
  readonly tone: 'success' | 'danger' | 'neutral'
}

interface ToastApi {
  readonly notify: (message: string, tone?: Toast['tone']) => void
}

const ToastContext = createContext<ToastApi>({ notify: () => undefined })

/**
 * Short confirmations in the bottom corner: "Invitation sent", "Key revoked".
 *
 * A mutation that succeeds and changes nothing visible on screen — a decline that removes
 * a card, a rotation that adds a row somewhere below — needs to say so. Five seconds, then gone.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([])

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => { setToasts((current) => current.filter((toast) => toast.id !== id)) }, 5000)
  }, [])

  const api = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[13px] font-medium shadow-[var(--shadow-e3)]',
              toast.tone === 'success' && 'border-[color:var(--border-success)]/50 bg-surface text-fg',
              toast.tone === 'danger' && 'border-[color:var(--border-danger)]/60 bg-surface text-fg-danger',
              toast.tone === 'neutral' && 'border-line bg-surface text-fg',
            )}
          >
            <Icon
              name={toast.tone === 'danger' ? 'warning' : 'check-circle'}
              size={18}
              className={toast.tone === 'success' ? 'text-fg-success' : undefined}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
