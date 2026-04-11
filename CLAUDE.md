# P&L Clerk

## Project

| Property | Value |
|----------|-------|
| **Name** | P&L Clerk |
| **Repo** | `srworksllc/pl-clerk` |
| **Path** | `/Users/stephenreinhardt/Sites/pl-clerk` |
| **Purpose** | AI-powered bookkeeping tool for any SMB |
| **Domain** | `app.plclerk.net` |
| **Inspiration** | SmartClerk.ai |

## Context

Upload bank/credit card statement PDFs → AI extracts and categorizes every transaction → generates P&L reports. No manual tagging needed. A small business can upload all their PDFs at year-end and get a complete P&L in minutes.

Single-user app for now, architected for multi-tenant SaaS. May open to public later.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15+ (App Router) |
| API | Hono (inside Next.js via `app/api/[[...route]]/route.ts`) |
| ORM | Drizzle ORM + PostgreSQL |
| Auth | Better Auth (email/password) |
| UI | Tailwind v4 + shadcn/ui (Radix) |
| File Storage | Local filesystem (`uploads/`) — migrate to R2 later |
| Deploy | Docker Compose + Caddy on Hetzner |

## Features

1. PDF statement upload (drag-and-drop, multi-file)
2. AI transaction extraction & categorization (Claude primary, OpenAI fallback)
3. P&L reports — by month, by category, exportable
4. Vendor management — unified names, spending totals
5. Category correction + learning (vendor rules + category overrides)
6. Custom categories — generic SMB defaults, fully customizable
7. Dashboard — income vs expenses at a glance
8. Excel/CSV export
9. Accountant access — read-only share links

## Key Architecture

- **Hono runs inside Next.js** — single deployment, no separate API server
- **Better Auth** at `/api/auth/[...all]`, Hono catch-all at `/api/[[...route]]`
- **AI pipeline**: pdf-parse → Claude extraction → vendor rule matching → AI categorization
- **Category learning**: vendor_rules (pattern match) → vendor_category_rules (user corrections) → AI fallback
- **`categoryManuallySet` flag** prevents AI from overwriting user corrections
