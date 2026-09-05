import { useEffect, useState } from 'react'

import { Icon } from './Icon'

type Theme = 'light' | 'dark'

/**
 * Switches the palette and remembers the choice.
 *
 * The initial value is read from the DOM rather than from storage, because the inline
 * script in `index.html` has already resolved it — including the system preference for
 * a user who has never chosen. Reading storage again here would disagree with what is
 * on screen for exactly those users.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      localStorage.setItem('orbit-theme', theme)
    } catch {
      // Private browsing, or storage disabled. The theme still applies for this
      // session; only the memory of it is lost.
    }
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
      className="grid size-8 place-items-center rounded-md text-fg-tertiary transition-colors hover:bg-hover hover:text-fg"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
