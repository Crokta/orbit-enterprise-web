import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card, DefinitionRow } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Toggle } from '../../components/ui/Inputs'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatCount } from '../../lib/format'
import { useMe } from '../session/useMe'

/**
 * SSO & security.
 *
 * Single sign-on is not yet available on the platform: identity signs enterprise users in
 * with a password, and there is no SAML integration to connect. The page says so rather
 * than drawing a healthy connection that does not exist — a settings screen that lies is
 * worse than one that is honest about what is coming.
 *
 * Audit retention is fixed platform-wide, so those figures are real.
 */
export function SecurityPage() {
  const me = useMe()
  const employees = me.data?.company.employees ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="SSO & security"
        subtitle="Single sign-on, session policy and audit retention"
        actions={<Button disabled title="Available once an identity provider is connected">Test connection</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <Card title="SAML single sign-on" subtitle="Not connected">
            <Banner tone="warning" title="Single sign-on is not available yet">
              Employees and admins sign in with their work email and a password. SAML with Microsoft Entra ID, Okta and Google Workspace is on the
              platform roadmap; when it ships, the connection is configured here and password sign-in can be switched off below.
            </Banner>

            <dl className="mt-4">
              <DefinitionRow label="Identity provider" value="—" mono />
              <DefinitionRow label="Sign-in URL" value="—" mono />
              <DefinitionRow label="Entity ID" value={me.data === undefined ? '—' : `urn:orbit:business:${me.data.company.companyId}`} mono />
              <DefinitionRow label="Certificate fingerprint" value="—" mono />
            </dl>
          </Card>

          <Card title="Session and access" subtitle={`Applies to all ${formatCount(employees)} employees and admins`}>
            <div className="divide-y divide-line-subtle">
              <Toggle checked={false} onChange={() => undefined} disabled label="Require SSO for all sign-ins" description="Password sign-in is disabled once this is on. Needs a connected identity provider." />
              <Toggle checked={true} onChange={() => undefined} disabled label="Lock after five failed sign-ins" description="Fifteen minutes, applied by the identity service to every account" />
              <Toggle checked={true} onChange={() => undefined} disabled label="Rotate refresh tokens on every use" description="A reused token revokes the whole session family" />
              <Toggle checked={false} onChange={() => undefined} disabled label="Auto-provision new employees" description="Create an Orbit account on first SSO sign-in. Needs a connected identity provider." />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Audit retention" subtitle="Set by Orbit for all customers — not configurable">
            <dl>
              <DefinitionRow label="Ride and trip records" value="7 years" mono />
              <DefinitionRow label="Admin audit log" value="7 years" mono />
              <DefinitionRow label="Sign-in events" value="13 months" mono />
              <DefinitionRow label="API request logs" value="90 days" mono />
            </dl>
            <p className="mt-3 text-[12px] text-fg-tertiary">
              Fixed platform-wide so records stay comparable across accounts and survive a customer changing their mind. Shorter retention needs a
              written request to compliance@orbit.ng.
            </p>
          </Card>

          <Card title="Danger zone" subtitle="Irreversible for your organisation">
            <Button variant="danger" className="w-full" disabled title="Nothing to disconnect: no identity provider is connected">
              Disconnect SSO
            </Button>
            <p className="mt-3 flex items-start gap-2 text-[12px] text-fg-tertiary">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              Disconnecting SSO signs out every employee immediately and re-enables password sign-in.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
