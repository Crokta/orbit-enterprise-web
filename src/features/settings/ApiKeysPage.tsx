import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { SearchInput } from '../../components/ui/Inputs'
import { ExportButton, FilterSelect, ListToolbar, Pagination } from '../../components/ui/ListControls'
import { LoadError } from '../../components/ui/LoadError'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../components/ui/cn'
import { enterprise, type ApiKey, type ApiKeyCreated, type ApiKeyScope } from '../../lib/api/enterprise'
import { ApiError } from '../../lib/api/problem'
import { formatDate, formatRelative, formatTime } from '../../lib/format'
import { useDebounced, usePagedList } from '../../lib/paging'
import { queryKeys } from '../../lib/query/client'
import { CreateApiKeyDialog } from './CreateApiKeyDialog'

export const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  ReadTrips: 'Read trips',
  ReadInvoices: 'Read invoices',
  ReadEmployeeNames: 'Read employee names',
  WriteBookRides: 'Write — book rides',
}

/** Server-to-server access for the company's travel and expense systems. */
export function ApiKeysPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  const [query, setQuery] = useState('')
  const [environment, setEnvironment] = useState<'all' | 'Live' | 'Sandbox'>('all')
  const q = useDebounced(query.trim())
  const params = useMemo(
    () => ({ q: q.length === 0 ? undefined : q, environment: environment === 'all' ? undefined : environment }),
    [q, environment],
  )

  const keys = usePagedList<ApiKey, typeof params>({
    key: queryKeys.apiKeys,
    filters: params,
    fetchPage: (page) => enterprise.apiKeys.list(page),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys })
  }

  const rotate = useMutation({
    mutationFn: (key: ApiKey) => enterprise.apiKeys.rotate(key.keyId),
    onSuccess: (result) => { setCreated(result); invalidate() },
    onError: (error) => { toast.notify(error instanceof ApiError ? error.message : 'The key could not be rotated.', 'danger') },
  })

  const revoke = useMutation({
    mutationFn: (key: ApiKey) => enterprise.apiKeys.revoke(key.keyId),
    onSuccess: (key) => { toast.notify(`${key.name} revoked`); invalidate() },
    onError: (error) => { toast.notify(error instanceof ApiError ? error.message : 'The key could not be revoked.', 'danger') },
  })

  const all = keys.items
  const active = all.filter((key) => key.status === 'Active' || key.status === 'Expiring')
  const retired = all.filter((key) => key.status === 'Revoked' || key.status === 'Expired')

  return (
    <div className="space-y-5">
      <PageHeader
        title="API keys"
        subtitle="Server-to-server access for your travel and expense systems"
        actions={
          <>
            <ExportButton path={enterprise.apiKeys.exportPath} query={params} filename="orbit-api-keys.csv" />
            <Button onClick={() => { setCreating(true); }}>Create key</Button>
          </>
        }
      />

      <ListToolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search keys by name or hint" className="w-[280px]" />
        <FilterSelect
          label="Environment"
          value={environment}
          onChange={setEnvironment}
          options={[
            { value: 'all', label: 'Live and sandbox' },
            { value: 'Live', label: 'Live' },
            { value: 'Sandbox', label: 'Sandbox' },
          ]}
        />
      </ListToolbar>

      <Banner tone="warning">
        Secret keys are shown once at creation and never again. Rotate a key if you suspect exposure — rotation keeps the old key valid for 24 hours.
      </Banner>

      {keys.query.isError ? (
        <LoadError error={keys.query.error} what="the API keys" onRetry={() => { void keys.query.refetch() }} />
      ) : (
        <section className="rounded-xl border border-line-subtle bg-surface shadow-[var(--shadow-e1)]">
          <header className="border-b border-line-subtle px-4 py-4">
            <h2 className="text-[16px] font-semibold">Active keys</h2>
            <p className="text-[12px] text-fg-tertiary">{active.length} of 10 keys used</p>
          </header>

          {keys.query.isPending ? (
            <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">Loading…</p>
          ) : active.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">No keys yet. Create one to connect an expense or travel system.</p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {active.map((key) => (
                <li key={key.keyId} className="flex items-center gap-4 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[15px] font-medium">
                      {key.name}
                      <Badge tone={key.environment === 'Live' ? 'success' : 'neutral'}>{key.environment}</Badge>
                      {key.status === 'Expiring' && key.expiresAt !== null && (
                        <Badge tone="warning">Rotated · valid until {formatTime(key.expiresAt)} {formatDate(key.expiresAt)}</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-fg-secondary">{key.hint}</p>
                    <p className="mt-0.5 text-[12px] text-fg-tertiary">
                      {key.scopes.map((scope) => SCOPE_LABELS[scope]).join(', ')} · {key.lastUsedAt === null ? 'never used' : `last used ${formatRelative(key.lastUsedAt)}`} · created by {key.createdBy}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <IconButton
                      label={`Rotate ${key.name}`}
                      icon="refresh"
                      disabled={key.status === 'Expiring' || rotate.isPending}
                      onClick={() => { rotate.mutate(key) }}
                    />
                    <IconButton
                      label={`Revoke ${key.name}`}
                      icon="trash"
                      tone="danger"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (window.confirm(`Revoke ${key.name}? Requests using it will fail immediately.`)) {
                          revoke.mutate(key)
                        }
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {retired.length > 0 && (
        <section className="rounded-xl border border-line-subtle bg-surface">
          <header className="border-b border-line-subtle px-4 py-3">
            <h2 className="text-[14px] font-semibold text-fg-secondary">Revoked and expired</h2>
          </header>
          <ul className="divide-y divide-line-subtle">
            {retired.map((key) => (
              <li key={key.keyId} className="flex items-center gap-4 px-4 py-3 text-fg-tertiary">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-fg-secondary">
                    {key.name} <Badge tone="neutral">{key.status}</Badge>
                  </p>
                  <p className="font-mono text-[12px]">{key.hint}</p>
                </div>
                <p className="text-[12px]">
                  {key.revokedAt !== null ? `Revoked ${formatDate(key.revokedAt)}` : key.expiresAt !== null ? `Expired ${formatDate(key.expiresAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!keys.query.isError && <Pagination list={keys} />}

      <CreateApiKeyDialog
        open={creating}
        onClose={() => { setCreating(false); }}
        onCreated={(result) => { setCreating(false); setCreated(result); invalidate() }}
        created={created}
        onDone={() => { setCreated(null); }}
      />
    </div>
  )
}

function IconButton({
  label,
  icon,
  tone = 'neutral',
  disabled,
  onClick,
}: {
  readonly label: string
  readonly icon: 'refresh' | 'trash'
  readonly tone?: 'neutral' | 'danger'
  readonly disabled?: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'border-[color:var(--border-danger)]/40 bg-danger-subtle text-fg-danger hover:brightness-95'
          : 'border-line bg-surface text-fg-secondary hover:bg-hover hover:text-fg',
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}
