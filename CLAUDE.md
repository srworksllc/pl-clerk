# P&L Clerk

## Project

| Property | Value |
|----------|-------|
| **Name** | P&L Clerk |
| **Repo** | `srworksllc/pl-clerk` |
| **Path** | `/Users/stephenreinhardt/Sites/pl-clerk` |
| **Domain** | `app.plclerk.net` |
| **Server** | `5.78.77.83` (Hetzner, Debian 13) |
| **Purpose** | AI-powered bookkeeping for any SMB — upload statements, get P&L |

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| API | Hono (inside Next.js via `app/api/[[...route]]/route.ts`) |
| ORM | Drizzle + PostgreSQL 17 (self-hosted on server) |
| Auth | Better Auth (email/password, session cookies) |
| UI | Tailwind v4 + shadcn/ui (new-york style, Radix primitives) |
| Fonts | Geist + Geist Mono |
| File Storage | Local filesystem (`uploads/`) — migrate to R2 later |
| Deploy | systemd service `plclerk` + Caddy reverse proxy |
| AI Extraction | GPT-4.1 mini (fast, cheap, accurate for structured JSON) |
| AI Categorization | Claude Haiku 4.5 (business context understanding) |

## Server Infrastructure

- **Service**: `systemctl {start,stop,restart,status} plclerk`
- **User**: `plclerk:plclerk`
- **App dir**: `/var/www/plclerk/`
- **Env**: `/var/www/plclerk/.env` (chmod 640, owned by plclerk)
- **Postgres**: local, user `plclerk`, db `plclerk`
- **Deploy**: `./deploy.sh` (rsync standalone + static, restart service)

## MCP Servers

Configured in `.mcp.json`:
```json
{ "mcpServers": { "shadcn": { "command": "npx", "args": ["-y", "@jpisnice/shadcn-ui-mcp-server"] } } }
```

**ALWAYS use the shadcn MCP server** (`mcp__shadcn__*`) when doing UI work. Match blocks exactly (dashboard-01 for layout, login-01 for auth pages). No custom UI — only stock components.

## UI System (Non-Negotiable)

- **shadcn/ui new-york style** is the only component system
- `components.json` must have `"style": "new-york"` (NOT `radix-nova` — the Nova preset breaks everything)
- **No custom styles** — only Tailwind utility classes via shadcn patterns
- **Layout**: `SidebarProvider` with `variant="inset"` sidebar, `collapsible="icon"`, `SidebarRail` for resize
- **Header pattern** (every app page):
  ```tsx
  <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
    <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <h1 className="text-base font-medium">Page Title</h1>
    </div>
  </header>
  ```
- **Content pattern**: `<div className="mx-auto w-full max-w-5xl flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">`
- **Layout CSS vars**: `SidebarProvider style={{"--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)"}}`

## Colors

**No red/green "christmas theme".** Finance apps use neutral colors:
- Income amounts: `text-foreground` (neutral) with `+` prefix
- Expense amounts: `text-muted-foreground` with `-` prefix
- Net loss only: `text-destructive` (the one thing that needs attention)
- Status icons (upload success/error): green/red is OK — universal
- Money values: ALWAYS `tabular-nums` class for column alignment

## Pages (4 total)

| Page | Path | Purpose |
|------|------|---------|
| Upload | `/upload` | Drag-drop PDFs, see processing steps, recent uploads list |
| Transactions | `/transactions` | All / Uncategorized (by vendor batch) / By Vendor tabs |
| P&L Report | `/reports` | Live report with date picker, Income → COGS → Gross Profit → Expenses → Net Profit |
| Settings | `/settings` | Categories, accountant sharing, account |

Root `/` redirects to `/upload`. Auth gate redirects unauthenticated users to `/login`.

## Categories (Schedule C)

22 seeded categories mapping to IRS Schedule C lines. Types: `income`, `cogs`, `expense`. Seeded automatically via Better Auth `databaseHooks.user.create.after` hook. See `src/lib/constants.ts` for the full list and `CATEGORY_TAX_LINES` mapping.

## AI Pipeline

```
Upload PDF → Save to disk
  ↓
Step 1: Reading file (unpdf extracts text per page)
  ↓
Step 2: Extracting (GPT-4.1 mini, 3 pages parallel, retry 2x)
  ↓
Step 3: Matching vendors (deterministic lookup)
  ↓
Step 4: Categorizing (Claude Haiku, batches of 30, 3 parallel, retry 2x)
  ↓
Step 5: Saving (atomic DB insert — everything appears at once)
```

**Categorization lookup order**:
1. User's personal vendor rules (always wins)
2. Global vendor database (5+ votes, 80%+ agreement → auto-apply)
3. Claude Haiku AI (conservative — null if unsure)
4. Leave uncategorized → user reviews in batch UI

**Global vendor intelligence**: `global_vendor_categories` table stores anonymous vendor→category votes. Every categorization records a vote. More users = smarter auto-categorization.

## Key Architecture Decisions

- **Direct `fetch` to AI APIs**, NOT the SDKs. Anthropic/OpenAI SDKs hang indefinitely in Next.js standalone build. Use `AbortSignal.timeout(120_000)`.
- **Atomic processing**: nothing inserted until entire pipeline completes. No partial states.
- **All-or-nothing for bank data**: if any page fails extraction, whole statement errors out. Bank data must be complete.
- **Progress tracking**: `statements.processing_step` column updated as pipeline advances. UI polls every 3s.
- **Duplicate detection**: upload rejects same filename + file size combo (409 error).
- **Page boundary dedup**: deduplicates transactions by date + amount + description prefix after extraction.

## Processing Performance

- ~45 seconds for 6-page statement (was ~3 minutes before parallelization)
- ~$0.005 per page extraction (GPT-4.1 mini), ~$0.01 per 30 categorizations (Haiku)
- Statement processing is fire-and-forget — HTTP response returns immediately, UI polls

## Vendor Batch Categorization

Uncategorized tab shows a table: vendor name, transaction count, total, category dropdown. Picking a category:
1. Updates all transactions from that vendor
2. Creates a vendor rule (future statements auto-categorize)
3. Records a global vote
4. Optimistically updates UI (no refresh needed)

## Known Quirks

- `unpdf` prints font warnings ("Type3 font resource not available") — harmless, extraction still works
- Base64 PDFs are too large for bash command args — use stdin or temp files
- Drizzle generate requires TTY — use manual migration SQL files for schema changes in CI
- `components.json` preset `radix-nova` adds `group/card`, `font-heading`, size variants — NOT stock. Always reinit with `-b radix --preset default` if components drift.
