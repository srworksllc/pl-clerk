# P&L Clerk

## Project

| Property | Value |
|----------|-------|
| **Name** | P&L Clerk |
| **Repo** | `srworksllc/pl-clerk` |
| **Path** | `/Users/stephenreinhardt/Sites/pl-clerk` |
| **Purpose** | Internal AI-powered bookkeeping tool for Story Co (construction) |
| **Domain** | `app.plclerk.io` |
| **Inspiration** | SmartClerk.ai |

## Context

Built to replace QuickBooks for Story Co. Core idea: upload bank/credit card statements (PDF), AI categorizes every transaction automatically, generates P&L reports — no manual tagging.

Single-user app hosted at `app.plclerk.io` — no marketing site, no multi-tenant auth for now. May become a SaaS product later.

## Inspiration (SmartClerk.ai)

Key features to draw from:

- **PDF statement upload** — drag-and-drop bank/CC statements
- **AI categorization** — auto-categorize transactions with 99%+ accuracy, learns from corrections
- **P&L reports** — month-by-month spending by category and vendor
- **Vendor management** — unified vendor names, spending totals across accounts
- **Balance sheets** — generated from statement data
- **Excel export** — all reports exportable
- **Multi-account** — multiple bank accounts and credit cards
- **Custom categories** — business-specific (construction: materials, labor, subs, equipment, permits, etc.)
