import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { enterprise } from '../../lib/api/enterprise'
import { queryKeys } from '../../lib/query/client'
import { useMe } from '../../features/session/useMe'
import { Icon } from './Icon'

/**
 * The bell in the page header.
 *
 * The console has no notification feed of its own; what wants attention is the approval
 * queue, for the people who can act on it. The dot appears when something is waiting and
 * the bell takes them there. For everyone else it is quiet.
 */
export function NotificationBell() {
  const me = useMe()
  const approver = me.data?.isApprover === true

  const queue = useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => enterprise.approvals.queue({ limit: 200 }),
    enabled: approver,
    refetchInterval: 60_000,
  })

  const pending = queue.data?.items.length ?? 0

  return (
    <Link
      to="/approvals"
      aria-label={pending > 0 ? `${String(pending)} approvals waiting` : 'Notifications'}
      className="relative grid size-9 place-items-center rounded-md text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
    >
      <Icon name="bell" size={20} />
      {pending > 0 && (
        <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-[var(--bg-surface)]" />
      )}
    </Link>
  )
}
