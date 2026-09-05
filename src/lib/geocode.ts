/**
 * Address search for the booking form.
 *
 * Mapbox's forward geocoder, called from the browser with the PUBLIC token — the same
 * token the mobile apps ship with, scoped at mapbox.com. This is the one call in the
 * console that does not go through the gateway: it is a third-party lookup of a place
 * name, carries no Orbit credential, and the gateway has no geocoding route to offer.
 */
export interface Place {
  readonly id: string
  readonly name: string
  readonly address: string
  readonly latitude: number
  readonly longitude: number
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

/** Whether address search is available. Without a token the form accepts coordinates. */
export function hasGeocoding(): boolean {
  return TOKEN.startsWith('pk.')
}

// Lagos. Results are biased towards it, because that is where the platform operates
// and "Ikeja" on its own should not resolve to a street in Texas.
const PROXIMITY = '3.3792,6.5244'

interface MapboxFeature {
  readonly id: string
  readonly geometry: { readonly coordinates: readonly [number, number] }
  readonly properties: {
    readonly name?: string
    readonly full_address?: string
    readonly place_formatted?: string
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<readonly Place[]> {
  if (!hasGeocoding() || query.trim().length < 3) {
    return []
  }

  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')
  url.searchParams.set('q', query)
  url.searchParams.set('access_token', TOKEN)
  url.searchParams.set('country', 'NG')
  url.searchParams.set('proximity', PROXIMITY)
  url.searchParams.set('limit', '5')
  url.searchParams.set('autocomplete', 'true')

  const response = await fetch(url, signal === undefined ? {} : { signal })

  if (!response.ok) {
    return []
  }

  const body = (await response.json()) as { readonly features?: readonly MapboxFeature[] }

  return (body.features ?? []).map((feature) => ({
    id: feature.id,
    name: feature.properties.name ?? feature.properties.full_address ?? 'Unnamed place',
    address: feature.properties.place_formatted ?? feature.properties.full_address ?? '',
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  }))
}

/** Degrees to the E7 integers every Orbit service uses. */
export function toE7(degrees: number): number {
  return Math.round(degrees * 1e7)
}
