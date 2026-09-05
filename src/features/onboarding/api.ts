import { api, newIdempotencyKey } from '../../lib/api/client'

/**
 * The setup wizard's endpoints, typed once. Shapes mirror the BFF's onboarding DTOs.
 */

export type CompanyStatus = 'draft' | 'onboarding' | 'live' | 'at_risk' | 'churned'
export type OnboardingStage = 'signed' | 'kyb_review' | 'billing_setup' | 'employee_import' | 'policy_go_live' | 'live'
export type DocumentType = 'cac_certificate' | 'tin_certificate' | 'cac_status_report' | 'proof_of_address'
export type PaymentTerms = 'invoice_net_30' | 'invoice_net_7' | 'card_on_file'

export interface OnboardingDocument {
  readonly documentId: string
  readonly type: DocumentType
  readonly label: string
  readonly status: 'received' | 'accepted' | 'rejected'
  readonly fileName: string
  readonly sizeBytes: number
  readonly uploadedAt: string
  readonly note: string | null
}

export interface OnboardingState {
  readonly companyId: string
  readonly companyName: string
  readonly status: CompanyStatus
  readonly stage: OnboardingStage
  readonly currentStep: number
  readonly company: {
    readonly legalName: string
    readonly rcNumber: string | null
    readonly tin: string | null
    readonly industry: string | null
    readonly registeredAddress: string | null
    readonly expectedSeatsMin: number | null
    readonly expectedSeatsMax: number | null
    readonly setupName: string | null
    readonly setupRole: string | null
    readonly setupEmail: string | null
    readonly setupPhone: string | null
    readonly verifiedDomain: string | null
    readonly signatoryConfirmed: boolean
    readonly done: boolean
  }
  readonly verification: {
    readonly status: 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected'
    readonly submittedAt: string | null
    readonly decidedAt: string | null
    readonly rejectionReason: string | null
    readonly documents: readonly OnboardingDocument[]
    readonly missing: readonly DocumentType[]
    readonly done: boolean
  }
  readonly billing: {
    readonly paymentTerms: PaymentTerms
    readonly billingContactName: string | null
    readonly billingEmail: string | null
    readonly poNumber: string | null
    readonly billingAddress: string | null
    readonly creditLimitMinor: number | null
    readonly commissionRate: number
    readonly currency: string
    readonly estimatedMonthlyLowMinor: number
    readonly estimatedMonthlyHighMinor: number
    readonly done: boolean
  }
  readonly employees: {
    readonly invited: number
    readonly needingCostCentre: number
    readonly costCentres: readonly { readonly code: string; readonly name: string }[]
    readonly done: boolean
  }
  readonly policy: {
    readonly perRideCapMinor: number | null
    readonly hoursFrom: string | null
    readonly hoursTo: string | null
    readonly weekdaysOnly: boolean
    readonly airportRunsBypassCap: boolean
    readonly requireReasonForEveryRide: boolean
    readonly requireProjectCode: boolean
    readonly allowPersonalTrips: boolean
    readonly defaultApproverEmployeeId: string | null
    readonly escalateAfterMinutes: number
    readonly fourEyesOverMinor: number | null
    readonly approvers: readonly { readonly employeeId: string; readonly name: string; readonly email: string }[]
    readonly suggestedCapMinor: number
    readonly done: boolean
  }
  readonly goLive: {
    readonly canGoLive: boolean
    readonly blockers: readonly string[]
    readonly liveAt: string | null
    readonly termsAcceptedAt: string | null
    readonly firstInvoiceOn: string
  }
  readonly accountManagerName: string | null
  readonly accountManagerEmail: string | null
  readonly ownerEmployeeId: string
  readonly ownerEmail: string
}

export interface ImportRow {
  readonly row: number
  readonly name: string
  readonly email: string
  readonly costCentre: string | null
  readonly issue: 'invalid_email' | 'personal_domain' | 'missing_cost_centre' | 'unknown_cost_centre' | 'duplicate' | 'already_invited' | null
  readonly issueDetail: string | null
  readonly skip?: boolean
}

export interface ImportPreview {
  readonly rows: readonly ImportRow[]
  readonly ready: number
  readonly needAttention: number
  readonly duplicatesSkipped: number
  readonly costCentres: readonly { readonly code: string; readonly name: string }[]
  readonly unknownCostCentres: readonly string[]
}

export interface ImportResult {
  readonly invited: number
  readonly skipped: number
  readonly costCentresCreated: number
  readonly state: OnboardingState
}

const BASE = '/v1/enterprise/onboarding'

export const onboarding = {
  claim: (token: string) => api.post<OnboardingState>(`${BASE}/claim`, { json: { token }, idempotencyKey: newIdempotencyKey() }),
  state: () => api.get<OnboardingState>(`${BASE}/me`),

  saveCompany: (body: {
    readonly legalName: string
    readonly rcNumber: string
    readonly tin: string
    readonly industry?: string
    readonly registeredAddress?: string
    readonly expectedSeatsMin?: number
    readonly expectedSeatsMax?: number
    readonly setupName: string
    readonly setupRole?: string
    readonly setupPhone?: string
    readonly signatoryConfirmed: boolean
  }) => api.put<OnboardingState>(`${BASE}/company`, { json: body, idempotencyKey: newIdempotencyKey() }),

  uploadDocument: (type: DocumentType, file: File) => {
    const form = new FormData()
    form.set('type', type)
    form.set('file', file)
    return api.post<OnboardingState>(`${BASE}/documents`, { raw: form, idempotencyKey: newIdempotencyKey() })
  },

  removeDocument: (documentId: string) =>
    api.delete<OnboardingState>(`${BASE}/documents/${encodeURIComponent(documentId)}`, { idempotencyKey: newIdempotencyKey() }),

  submitVerification: () => api.post<OnboardingState>(`${BASE}/verification/submit`, { idempotencyKey: newIdempotencyKey() }),

  saveBilling: (body: {
    readonly paymentTerms: PaymentTerms
    readonly billingContactName: string
    readonly billingEmail: string
    readonly poNumber?: string
    readonly billingAddress?: string
  }) => api.put<OnboardingState>(`${BASE}/billing`, { json: body, idempotencyKey: newIdempotencyKey() }),

  previewImport: (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return api.post<ImportPreview>(`${BASE}/employees/preview`, { raw: form, idempotencyKey: newIdempotencyKey() })
  },

  importEmployees: (rows: readonly ImportRow[], newCostCentres: readonly { readonly code: string; readonly name: string }[]) =>
    api.post<ImportResult>(`${BASE}/employees/import`, { json: { rows, newCostCentres }, idempotencyKey: newIdempotencyKey() }),

  savePolicy: (body: {
    readonly perRideCapMinor: number
    readonly hoursFrom?: string
    readonly hoursTo?: string
    readonly weekdaysOnly: boolean
    readonly airportRunsBypassCap: boolean
    readonly requireReasonForEveryRide: boolean
    readonly requireProjectCode: boolean
    readonly allowPersonalTrips: boolean
    readonly defaultApproverEmployeeId?: string
    readonly escalateAfterMinutes: number
    readonly fourEyesOverMinor?: number
  }) => api.put<OnboardingState>(`${BASE}/policy`, { json: body, idempotencyKey: newIdempotencyKey() }),

  goLive: () => api.post<OnboardingState>(`${BASE}/go-live`, { json: { acceptTerms: true }, idempotencyKey: newIdempotencyKey() }),
}

export const onboardingKey = ['onboarding', 'state'] as const

export const DOCUMENT_HINT: Record<DocumentType, string> = {
  cac_certificate: 'The certificate of incorporation',
  tin_certificate: 'From FIRS or the JTB portal',
  cac_status_report: 'Lists your directors',
  proof_of_address: 'Utility bill or lease, under 3 months',
}

export function naira(minor: number): string {
  return `₦${(minor / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

export function compactNaira(minor: number): string {
  const major = minor / 100

  if (Math.abs(major) >= 1_000_000) {
    return `₦${(major / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }

  return naira(minor)
}
