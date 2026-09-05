import { useQuery } from '@tanstack/react-query'

import { enterprise, type Me } from '../../lib/api/enterprise'
import { queryKeys } from '../../lib/query/client'

/**
 * The signed-in employee.
 *
 * Fetched once and shared: the shell needs it to draw the right navigation, the booking
 * form needs the policy, the sidebar needs the name. Every consumer reads the same cache
 * entry, so the sidebar and the page can never disagree about who is signed in.
 */
export function useMe() {
  return useQuery<Me>({
    queryKey: queryKeys.me,
    queryFn: enterprise.me,
    staleTime: 5 * 60_000,
  })
}
