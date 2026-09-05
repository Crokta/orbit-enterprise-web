import { Button } from '../../components/ui/Button'
import { Card, DefinitionRow } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { vehicleLabel } from '../../lib/api/enterprise'
import { formatCount, formatMoney } from '../../lib/format'
import { useMe } from '../session/useMe'
import { useNavigate } from '@tanstack/react-router'

/** The policy an employee books under, in the words they will meet while booking. */
export function MyPolicyPage() {
  const me = useMe()
  const navigate = useNavigate()
  const policy = me.data?.policy ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Your travel policy"
        subtitle={policy === null ? 'No policy applies to your account' : `${policy.name} — applies to ${formatCount(policy.activeEmployees)} employees at ${me.data?.company.name ?? 'your company'}`}
        actions={<Button onClick={() => { void navigate({ to: '/book' }) }}>Book a ride</Button>}
      />

      {policy === null ? (
        <Card>
          <p className="text-[14px]">Every ride you book on the company account goes through immediately. Nothing needs approval.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="What books immediately">
            <dl>
              <DefinitionRow label="Per-ride cap" value={policy.approvalThresholdMinor === null ? 'No cap' : `Up to ${formatMoney(policy.approvalThresholdMinor, policy.currency)}`} />
              <DefinitionRow label="Allowed hours" value={policy.permittedFrom === null ? 'Any time' : `${policy.permittedFrom} – ${policy.permittedTo ?? ''}`} />
              <DefinitionRow label="Ride tiers" value={policy.allowedClasses.length === 0 ? 'Every tier' : policy.allowedClasses.map(vehicleLabel).join(', ')} />
              <DefinitionRow label="Cost centre" value={policy.requiresCostCentre ? 'Must be set on every ride' : 'Optional'} />
            </dl>
          </Card>

          <Card title="What needs approval">
            <ul className="space-y-2 text-[14px]">
              {policy.approvalThresholdMinor !== null && <li>Fares above {formatMoney(policy.approvalThresholdMinor, policy.currency)}</li>}
              {policy.permittedFrom !== null && <li>Rides outside {policy.permittedFrom} – {policy.permittedTo ?? ''}</li>}
              {policy.requiresApprovalForSurge && <li>Any ride while surge pricing applies</li>}
              {policy.requiresCostCentre && <li>A ride booked without a cost centre</li>}
              {policy.hardCapMinor !== null && <li className="text-fg-danger">Fares above {formatMoney(policy.hardCapMinor, policy.currency)} cannot be booked at all</li>}
              {policy.allowedClasses.length > 0 && <li className="text-fg-danger">Tiers other than {policy.allowedClasses.map(vehicleLabel).join(' and ')} cannot be booked</li>}
            </ul>
            <p className="mt-4 text-[12px] text-fg-tertiary">Approvals usually take minutes. A request expires after 15 minutes if nobody answers, and nothing is charged.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
