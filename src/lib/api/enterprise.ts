import { api } from './client'

/**
 * Every enterprise endpoint the console calls, typed once.
 *
 * The shapes here mirror the BFF's DTOs field for field. A page that declares its own
 * interface drifts: the policies page once asked for fields the service never sent and
 * rendered ₦NaN on the screen a travel manager uses to decide what staff may spend.
 */

export type AdminRole = 'Member' | 'TravelAdmin' | 'BillingAdmin' | 'Owner'
export type EmployeeStatus = 'Invited' | 'Active' | 'Suspended'

export interface Company {
  readonly companyId: string
  readonly name: string
  readonly verifiedDomain: string | null
  readonly currency: string
  readonly employees: number
  /** draft, onboarding, live, at_risk or churned. */
  readonly status: 'draft' | 'onboarding' | 'live' | 'at_risk' | 'churned'
  readonly stage: 'signed' | 'kyb_review' | 'billing_setup' | 'employee_import' | 'policy_go_live' | 'live'
  /** False until verification passes. The booking screens say so instead of quoting. */
  readonly canBook: boolean
}

export interface Policy {
  readonly policyId: string
  readonly name: string
  readonly approvalThresholdMinor: number | null
  readonly hardCapMinor: number | null
  readonly currency: string
  readonly allowedClasses: readonly string[]
  readonly permittedFrom: string | null
  readonly permittedTo: string | null
  readonly requiresCostCentre: boolean
  readonly requiresApprovalForSurge: boolean
  readonly isActive: boolean
  readonly activeEmployees: number
}

export interface PolicyRules {
  readonly name: string
  readonly approvalThresholdMinor: number | null
  readonly hardCapMinor: number | null
  readonly currency: string
  readonly allowedClasses: readonly string[]
  readonly permittedFrom: string | null
  readonly permittedTo: string | null
  readonly requiresCostCentre: boolean
  readonly requiresApprovalForSurge: boolean
}

export interface Me {
  readonly employeeId: string
  readonly workEmail: string
  readonly displayName: string | null
  readonly status: EmployeeStatus
  readonly role: AdminRole
  readonly isApprover: boolean
  readonly canBookForVisitors: boolean
  readonly costCentreCode: string | null
  readonly costCentreName: string | null
  readonly company: Company
  readonly policy: Policy | null
  readonly tripsThisMonth: number
  readonly spendThisMonthMinor: number
  readonly policyBreachesThisMonth: number
  readonly currency: string
}

export interface PeriodSummary {
  readonly rides: number
  readonly spendMinor: number
  readonly averageFareMinor: number
  readonly policyBreaches: number
}

export interface Dashboard {
  readonly ridesThisMonth: number
  readonly spendMinor: number
  readonly currency: string
  readonly activeEmployees: number
  readonly pendingApprovals: number
  readonly policyBreaches: number
  readonly averageFareMinor: number
  readonly previous: PeriodSummary
  readonly totalEmployees: number
  readonly neverTravelled: number
}

export interface Employee {
  readonly employeeId: string
  readonly workEmail: string
  readonly displayName: string | null
  readonly status: EmployeeStatus
  readonly role: AdminRole
  readonly costCentre: string | null
  readonly policyId: string | null
  readonly isApprover: boolean
  readonly canBookForVisitors: boolean
  readonly tripsThisMonth: number
  readonly monthlySpendMinor: number
  readonly currency: string
  readonly invitedAt: string
  readonly activatedAt: string | null
}

export interface CostCentre {
  readonly code: string
  readonly name: string
  readonly ownerEmployeeId: string
  readonly ownerName: string
  readonly employees: number
  readonly monthlyBudgetMinor: number | null
  readonly spendMinor: number
  readonly currency: string
  readonly isOverBudget: boolean
  readonly isActive: boolean
}

export interface Trip {
  readonly rideId: string
  readonly employeeId: string
  readonly employeeName: string
  readonly employeeEmail: string
  readonly costCentre: string | null
  readonly pickupLabel: string
  readonly dropoffLabel: string
  readonly fareMinor: number
  readonly currency: string
  readonly policyBreach: string | null
  readonly completedAt: string
}

export interface Page<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

/** What every list endpoint accepts on top of its own filters. */
export interface ListParams {
  readonly cursor?: string | undefined
  readonly limit?: number | undefined
  readonly q?: string | undefined
}

export interface EmployeeListParams extends ListParams {
  readonly status?: EmployeeStatus | undefined
  readonly role?: AdminRole | undefined
  readonly costCentre?: string | undefined
  readonly policyId?: string | undefined
  readonly admins?: boolean | undefined
  readonly neverTravelled?: boolean | undefined
}

export interface TripListParams extends ListParams {
  readonly employeeId?: string | undefined
  readonly costCentre?: string | undefined
  readonly breaches?: boolean | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
}

export interface MyTripListParams extends ListParams {
  readonly kind?: 'Ride' | 'Request' | undefined
  readonly status?: string | undefined
}

export interface MonthSummary {
  readonly month: string
  readonly rides: number
  readonly spendMinor: number
  readonly currency: string
}

export type InvoiceStatus = 'Due' | 'Paid' | 'Overdue' | 'Voided'

export interface Invoice {
  readonly invoiceId: string
  readonly period: string
  readonly totalMinor: number
  readonly currency: string
  readonly tripCount: number
  readonly status: InvoiceStatus
  readonly issuedAt: string
  readonly dueAt: string
}

export interface InvoiceStatement {
  readonly invoice: Invoice
  readonly trips: readonly Trip[]
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Declined' | 'Expired' | 'Withdrawn'

export interface Approval {
  readonly approvalId: string
  readonly employeeId: string
  readonly employeeName: string
  readonly employeeEmail: string
  readonly pickupLabel: string
  readonly dropoffLabel: string
  readonly estimatedFareMinor: number
  readonly currency: string
  readonly policyReason: string
  readonly costCentreCode: string | null
  readonly status: ApprovalStatus
  readonly decisionNote: string | null
  readonly decidedBy: string | null
  readonly requestedAt: string
  readonly expiresAt: string
  readonly decidedAt: string | null
  readonly rideId: string | null
}

export interface MyTrip {
  readonly id: string
  readonly kind: 'Ride' | 'Request'
  readonly pickupLabel: string
  readonly dropoffLabel: string
  readonly fareMinor: number
  readonly currency: string
  readonly costCentreCode: string | null
  readonly status: 'Completed' | ApprovalStatus
  readonly policyReason: string | null
  readonly decisionNote: string | null
  readonly at: string
  readonly expiresAt: string | null
  readonly rideId: string | null
}

export interface PolicyVerdict {
  readonly allowed: boolean
  readonly requiresApproval: boolean
  readonly reason: string | null
}

export interface QuoteOption {
  readonly vehicleClass: string
  readonly label: string
  readonly totalMinor: number
  readonly currency: string
  readonly etaSeconds: number
  readonly surgeMultiplier: number
  readonly quoteToken: string
  readonly policy: PolicyVerdict
}

export interface BookingResult {
  readonly rideId: string | null
  readonly approvalId: string | null
  readonly status: 'Booked' | 'AwaitingApproval'
}

export type ApiKeyEnvironment = 'Live' | 'Sandbox'
export type ApiKeyScope = 'ReadTrips' | 'ReadInvoices' | 'ReadEmployeeNames' | 'WriteBookRides'

export interface ApiKey {
  readonly keyId: string
  readonly name: string
  readonly environment: ApiKeyEnvironment
  readonly scopes: readonly ApiKeyScope[]
  readonly hint: string
  readonly status: 'Active' | 'Expiring' | 'Expired' | 'Revoked'
  readonly createdBy: string
  readonly createdAt: string
  readonly lastUsedAt: string | null
  readonly expiresAt: string | null
  readonly revokedAt: string | null
}

export interface ApiKeyCreated {
  readonly key: ApiKey
  readonly secret: string
  readonly auditHash: string
}

const BASE = '/v1/enterprise'

export const enterprise = {
  me: () => api.get<Me>(`${BASE}/me`),
  dashboard: () => api.get<Dashboard>(`${BASE}/dashboard`),

  employees: {
    list: (params: EmployeeListParams = {}) => api.get<Page<Employee>>(`${BASE}/employees`, { query: { ...params } }),
    exportPath: `${BASE}/employees/export.csv`,
    invite: (body: {
      readonly workEmail: string
      readonly displayName: string | null
      readonly costCentre: string | null
      readonly policyId: string | null
      readonly isApprover: boolean
      readonly canBookForVisitors: boolean
    }) => api.post<Employee>(`${BASE}/employees`, { json: body }),
    update: (
      employeeId: string,
      body: {
        readonly displayName?: string
        readonly costCentre?: string
        readonly policyId?: string
        readonly isApprover?: boolean
        readonly canBookForVisitors?: boolean
      },
    ) => api.patch<Employee>(`${BASE}/employees/${employeeId}`, { json: body }),
    suspend: (employeeId: string) => api.post<Employee>(`${BASE}/employees/${employeeId}/suspend`),
    reinstate: (employeeId: string) => api.post<Employee>(`${BASE}/employees/${employeeId}/reinstate`),
    setRole: (employeeId: string, role: AdminRole) =>
      api.put<Employee>(`${BASE}/employees/${employeeId}/role`, { json: { role } }),
  },

  policies: {
    list: (params: ListParams & { readonly active?: boolean | undefined } = {}) =>
      api.get<Page<Policy>>(`${BASE}/policies`, { query: { ...params } }),
    exportPath: `${BASE}/policies/export.csv`,
    create: (rules: PolicyRules) => api.post<Policy>(`${BASE}/policies`, { json: rules }),
    update: (policyId: string, rules: PolicyRules, isActive: boolean) =>
      api.put<Policy>(`${BASE}/policies/${policyId}`, { json: { rules, isActive } }),
  },

  costCentres: {
    list: (params: ListParams & { readonly active?: boolean | undefined } = {}) =>
      api.get<Page<CostCentre>>(`${BASE}/cost-centres`, { query: { ...params } }),
    exportPath: `${BASE}/cost-centres/export.csv`,
    create: (body: {
      readonly code: string
      readonly name: string
      readonly monthlyBudgetMinor: number | null
      readonly currency: string
      readonly ownerEmployeeId: string | null
    }) => api.post<CostCentre>(`${BASE}/cost-centres`, { json: body }),
  },

  trips: {
    page: (params: TripListParams = {}) => api.get<Page<Trip>>(`${BASE}/trips`, { query: { ...params } }),
    exportPath: `${BASE}/trips/export.csv`,
  },

  invoices: {
    list: (params: ListParams & { readonly status?: string | undefined } = {}) =>
      api.get<Page<Invoice>>(`${BASE}/invoices`, { query: { ...params } }),
    exportPath: `${BASE}/invoices/export.csv`,
    statement: (invoiceId: string) => api.get<InvoiceStatement>(`${BASE}/invoices/${invoiceId}/statement`),
  },

  approvals: {
    queue: (params: ListParams & { readonly status?: string | undefined; readonly employeeId?: string | undefined } = {}) =>
      api.get<Page<Approval>>(`${BASE}/approvals`, { query: { ...params } }),
    exportPath: `${BASE}/approvals/export.csv`,
    get: (approvalId: string) => api.get<Approval>(`${BASE}/approvals/${approvalId}`),
    decide: (approvalId: string, approve: boolean, note: string | null) =>
      api.post<Approval>(`${BASE}/approvals/${approvalId}/decide`, { json: { approve, note } }),
    withdraw: (approvalId: string) => api.post<Approval>(`${BASE}/approvals/${approvalId}/withdraw`),
  },

  my: {
    trips: (params: MyTripListParams = {}) => api.get<Page<MyTrip>>(`${BASE}/my/trips`, { query: { ...params } }),
    tripsExportPath: `${BASE}/my/trips/export.csv`,
    expenses: () => api.get<readonly MonthSummary[]>(`${BASE}/my/expenses`),
  },

  booking: {
    quote: (body: {
      readonly pickupLatE7: number
      readonly pickupLonE7: number
      readonly dropoffLatE7: number
      readonly dropoffLonE7: number
      readonly costCentre: string | null
    }) => api.post<readonly QuoteOption[]>(`${BASE}/quotes`, { json: body }),
    book: (
      body: {
        readonly quoteToken: string
        readonly vehicleClass: string
        readonly estimatedFareMinor: number
        readonly currency: string
        readonly surgeMultiplier: number
        readonly pickupLatE7: number
        readonly pickupLonE7: number
        readonly dropoffLatE7: number
        readonly dropoffLonE7: number
        readonly pickupLabel: string
        readonly dropoffLabel: string
        readonly costCentre: string | null
      },
      idempotencyKey: string,
    ) => api.post<BookingResult>(`${BASE}/rides`, { json: body, idempotencyKey }),
  },

  apiKeys: {
    list: (params: ListParams & { readonly status?: string | undefined; readonly environment?: ApiKeyEnvironment | undefined } = {}) =>
      api.get<Page<ApiKey>>(`${BASE}/api-keys`, { query: { ...params } }),
    exportPath: `${BASE}/api-keys/export.csv`,
    create: (body: { readonly name: string; readonly environment: ApiKeyEnvironment; readonly scopes: readonly ApiKeyScope[] }) =>
      api.post<ApiKeyCreated>(`${BASE}/api-keys`, { json: body }),
    rotate: (keyId: string) => api.post<ApiKeyCreated>(`${BASE}/api-keys/${keyId}/rotate`),
    revoke: (keyId: string) => api.delete<ApiKey>(`${BASE}/api-keys/${keyId}`),
  },
}

/** What to call someone: their name, or their address when no name was given. */
export function displayName(person: { readonly displayName: string | null; readonly workEmail: string }): string {
  return person.displayName ?? person.workEmail
}

/** Whether a role opens the management console. */
export function isAdmin(role: AdminRole): boolean {
  return role !== 'Member'
}

export function canManageTravel(role: AdminRole): boolean {
  return role === 'TravelAdmin' || role === 'Owner'
}

export function canManageBilling(role: AdminRole): boolean {
  return role === 'BillingAdmin' || role === 'Owner'
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  Member: 'Employee',
  TravelAdmin: 'Travel admin',
  BillingAdmin: 'Billing admin',
  Owner: 'Owner',
}

export const VEHICLE_CLASS_LABELS: Record<string, string> = {
  Economy: 'Orbit Go',
  Comfort: 'Orbit Comfort',
  Premium: 'Orbit Premium',
  Xl: 'Orbit XL',
}

export function vehicleLabel(vehicleClass: string): string {
  return VEHICLE_CLASS_LABELS[vehicleClass] ?? vehicleClass
}
