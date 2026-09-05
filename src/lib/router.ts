import { useRouterState } from '@tanstack/react-router'

/**
 * Reads one query-string parameter from the current location.
 *
 * Typed as a string rather than through the router's search schema: the only parameter
 * these pages take is a free-text `q` to pre-fill a search box, and a schema per page for
 * one optional string is more machinery than it saves.
 */
export function useSearchParam(name: string): string {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })
  return new URLSearchParams(searchStr).get(name) ?? ''
}

/** The last segment of the current path — the `$approvalId` of `/my-trips/$approvalId`. */
export function useLastPathSegment(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return pathname.split('/').filter((segment) => segment.length > 0).at(-1) ?? ''
}
