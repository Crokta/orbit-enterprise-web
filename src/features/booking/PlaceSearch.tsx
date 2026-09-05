import { useEffect, useId, useRef, useState } from 'react'

import { Icon } from '../../components/ui/Icon'
import { TextInput } from '../../components/ui/Inputs'
import { cn } from '../../components/ui/cn'
import { type Place, hasGeocoding, searchPlaces } from '../../lib/geocode'

/**
 * An address box with suggestions beneath it.
 *
 * Searches after a short pause rather than on every keystroke, so "Ikeja" costs one
 * lookup rather than five. Without a geocoding token the box accepts "lat, lon" so the
 * form still works on a machine with no Mapbox configured.
 */
export function PlaceSearch({
  id,
  value,
  onChange,
  placeholder,
}: {
  readonly id: string
  readonly value: Place | null
  readonly onChange: (place: Place | null) => void
  readonly placeholder: string
}) {
  const [text, setText] = useState(value?.name ?? '')
  const [suggestions, setSuggestions] = useState<readonly Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(value?.name ?? '')
  }, [value])

  useEffect(() => {
    if (!open || text.trim().length < 3 || text === value?.name) {
      return
    }

    const controller = new AbortController()

    const timer = setTimeout(() => {
      if (!hasGeocoding()) {
        const coords = parseCoordinates(text)
        setSuggestions(coords === null ? [] : [coords])
        return
      }

      searchPlaces(text, controller.signal)
        .then((places) => { setSuggestions(places); setActive(0) })
        .catch(() => { setSuggestions([]) })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, open, value])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [])

  function choose(place: Place) {
    onChange(place)
    setText(place.name)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={root} className="relative">
      <TextInput
        id={id}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={hasGeocoding() ? placeholder : 'lat, lon (address search is not configured)'}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          if (value !== null) {
            onChange(null)
          }
        }}
        onFocus={() => { setOpen(true); }}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) {
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((current) => Math.min(current + 1, suggestions.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            const place = suggestions[active]
            if (place !== undefined) {
              event.preventDefault()
              choose(place)
            }
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line-subtle bg-overlay shadow-[var(--shadow-e3)]"
        >
          {suggestions.map((place, index) => (
            <li
              key={place.id}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault() }}
              onClick={() => { choose(place); }}
              className={cn('flex cursor-pointer items-start gap-2.5 px-3 py-2.5', index === active ? 'bg-hover' : 'hover:bg-hover')}
            >
              <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-fg-tertiary" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-fg">{place.name}</span>
                {place.address.length > 0 && <span className="block truncate text-[12px] text-fg-tertiary">{place.address}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "6.5244, 3.3792" → a place, for machines without a geocoding token. */
function parseCoordinates(text: string): Place | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text)

  if (match === null) {
    return null
  }

  const latitude = Number(match[1])
  const longitude = Number(match[2])

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null
  }

  return { id: text, name: `${String(latitude)}, ${String(longitude)}`, address: 'Coordinates', latitude, longitude }
}
