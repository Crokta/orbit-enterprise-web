# orbit-enterprise-web

The corporate travel console. React 19, TypeScript, Tailwind 4 and TanStack, with design tokens generated from Figma and every call routed through the gateway.

|  |  |
|---|---|
| **Stack** | React 19 · TypeScript · Tailwind 4 · TanStack · Vite · pnpm |
| **Ports** | `5173` — Dev server |
| **Tests** | 23, all passing |
| **Technical reference** | [`docs/TECHNICAL.md`](docs/TECHNICAL.md) · [PDF](docs/orbit-enterprise-web-technical-reference.pdf) |

React 19 · TypeScript · Tailwind 4 · TanStack Query/Router/Table · Vite · pnpm.

## Everything goes through the gateway

There is **no service URL anywhere in this codebase**, in any environment. The browser calls
a same-origin `/api`, Vite proxies it in development and nginx proxies it in the container,
and both point at the YARP gateway.

The gateway is where authentication, rate limiting and header sanitisation happen. A client
that can reach a service directly is a client that can skip all three.

## Design tokens come from Figma

`src/design/tokens.generated.css` is extracted from the Orbit design system file and **must not
be edited by hand** — regenerate it. `theme.css` maps those tokens onto Tailwind 4's `@theme`,
so `bg-surface` and `--bg-surface` are the same thing rather than two things that happen to
agree today.

There is deliberately **no `tailwind.config.js`**. Tailwind 4 configures itself in CSS, and
having the theme in two places is how a token and a utility class drift apart.

Colours are named by **role, never by hue**. `bg-brand` survives a rebrand; `bg-blue-600` becomes
a find-and-replace across two applications.

## Money

Minor units all the way from the ledger to the `<Money>` component, which divides at the last
moment before a human reads it. Every earlier conversion to a float is a rounding error waiting
to be reconciled, and a ledger that disagrees with a receipt by one kobo is a ticket nobody can
close.

Amounts render in tabular figures and right-align in tables. A fare column with proportional
digits cannot be scanned, and scanning is the whole job.

## Tokens live in memory

The access token is a module-scoped variable — **never `localStorage`**. Anything in local
storage is readable by any script that ends up on the page, which includes whatever a
supply-chain compromise puts there. Losing it on reload is the cost; the httpOnly refresh cookie
pays it.

The token is treated as expired **30 seconds early**, so it does not lapse in flight between the
check and the server reading it.

Concurrent refreshes collapse into one request. Ten queries failing with 401 at the same moment
is the normal case after expiry, and ten refreshes rotate the token family ten times — which the
identity service correctly reads as reuse and answers by revoking the family (§11.1).

## Retry policy

Queries retry twice, and **only** on 429 or 5xx. TanStack's default retries everything three
times, which turns one 403 into four and makes an authorisation bug look like a slow page.

Mutations are **never** retried automatically. The ones that matter move money, and a silent
retry of a request whose response was lost is a second charge. Retrying is the user's decision,
with the same idempotency key — which is what makes it safe.

## Policy is checked before booking, not after

The quote and the policy verdict arrive together. A ride the policy forbids is not selectable at
all, with the reason shown next to it. Telling an employee their ride is confirmed and then that
it needs their manager's approval is how a travel tool loses the people who use it daily.

Surge is disclosed on the option, before booking. A fare higher than quoted with no warning is
the single most complained-about thing in ride hailing (§9.3).

## Run it

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Then http://localhost:5173. The gateway must be running — see `orbit-api-gateway`.

| | |
|---|---|
| `pnpm dev` | Vite, proxying `/api` to the gateway |
| `pnpm build` | Typecheck, then production bundle |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint, type-aware |

`no-floating-promises` is an error, not a warning. A floating promise in a mutation handler is a
request that silently never completed, and the user is left looking at a spinner.

## Container

Multistage. The build toolchain exists only in the first stage; what ships is static files and
nginx running as UID 64198. A production image containing a compiler is a production image
containing an attacker's toolchain.

`index.html` is served `no-store` while hashed assets are cached for a year — the HTML is the
file that names the current assets, so a stale copy pins a user to a deployment that no longer
exists.

```bash
cp .env.example .env
docker compose up -d --build
```

## Tests

23. The ones worth reading assert that a loading button cannot be clicked twice, that concurrent
refreshes collapse into one request, and that a 409 is not retried.

---

## Further reading

| | |
|---|---|
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | The full technical reference: architecture, domain model, design decisions, data model, API, events, flows, failure modes, configuration and testing |
| [`docs/orbit-enterprise-web-technical-reference.pdf`](docs/orbit-enterprise-web-technical-reference.pdf) | The same document, typeset |
| [`../README.md`](../README.md) | The platform: every service, how they fit together, and how to bring the whole thing up |
| [`../architecture.md`](../architecture.md) | The specification this was built from |

This repository is **independent**. It has its own git history, its own build and its own
deployment lifecycle; nothing above its root is inherited.
