# Troy Feature — Implementation & Architecture Documentation

## Overview

Troy is an asset-centric chat feature that integrates external IoT device management (via MyDevices/Spenergy API) with the GoClaw agent chat system. It allows users to browse locations and devices, then have AI agent conversations scoped to specific assets.

The feature adds a 5-column UI (Sidebar → Locations → Assets → Chat Threads → Chat Messages) and a new backend module that bridges external API data with the existing session/chat infrastructure.

---

## Architecture Decision: Modular Additive Pattern

The implementation follows a strict **additive-only** approach to minimize risk to the existing codebase:

| Principle | How Applied |
|-----------|-------------|
| No modification of existing logic | Existing session creation, chat hooks, and agent pipeline are untouched |
| New files for new features | All Troy code lives in dedicated files/directories |
| Interface-based extension | New `AssetSessionStore` interface follows existing store patterns |
| Configuration-gated activation | Troy only activates when env vars are present; otherwise the system behaves identically to before |
| Reuse existing UI components | Troy's chat column reuses `ChatThread`, `ChatInput`, `ChatTopBar` from the existing chat page |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                 │
├──────────┬──────────┬──────────┬──────────────┬─────────────────────────────┤
│ Sidebar  │Locations │ Assets   │ Chat Threads │ Chat Messages                │
│ (Troy)   │ Column   │ Column   │ Column       │ Column                       │
│          │          │          │              │                              │
│          │ GET      │ GET      │ GET/POST     │ Reuses existing              │
│          │ /v1/troy │ /v1/troy │ /v1/troy/    │ useChatMessages +            │
│          │/locations│ /devices │asset-sessions│ useChatSend hooks            │
└──────────┴────┬─────┴────┬─────┴──────┬───────┴──────────────┬──────────────┘
                │          │            │                      │
                ▼          ▼            ▼                      ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         GoClaw HTTP Server (Go)                                │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    TroyHandler (internal/http/troy.go)                    │  │
│  │  GET /v1/troy/locations          → TroyClient.GetLocations()             │  │
│  │  GET /v1/troy/devices            → TroyClient.GetDevices()               │  │
│  │  GET /v1/troy/asset-sessions     → AssetSessionStore.ListByAsset()       │  │
│  │  POST /v1/troy/asset-sessions    → AssetSessionStore.Create()            │  │
│  │  DELETE /v1/troy/asset-sessions/ → AssetSessionStore.Delete()            │  │
│  └───────────────┬──────────────────────────────────────┬───────────────────┘  │
│                  │                                      │                      │
│                  ▼                                      ▼                      │
│  ┌───────────────────────────┐       ┌────────────────────────────────────┐   │
│  │   Troy Client             │       │   AssetSessionStore                 │   │
│  │   (internal/troy/)        │       │   (internal/store/)                 │   │
│  │                           │       │                                     │   │
│  │  • OAuth token mgmt      │       │  • PG implementation                │   │
│  │  • Company resolution     │       │  • SQLite implementation            │   │
│  │  • Locations API          │       │  • asset_sessions table             │   │
│  │  • Devices API            │       │                                     │   │
│  └───────────┬───────────────┘       └────────────────────────────────────┘   │
│              │                                                                  │
└──────────────┼──────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│   External APIs (MyDevices)       │
│                                   │
│  auth.mydevices.com (OAuth)       │
│  api.mydevices.com  (REST)        │
└──────────────────────────────────┘
```

---

## File Inventory

### Backend — New Files

| File | Purpose |
|------|---------|
| `internal/troy/client.go` | External API client: OAuth lifecycle, company/location/device fetching |
| `internal/http/troy.go` | HTTP handler implementing `routeRegistrar` interface |
| `internal/store/asset_session_store.go` | Store interface definition |
| `internal/store/pg/asset_sessions.go` | PostgreSQL store implementation |
| `internal/store/sqlitestore/asset_sessions.go` | SQLite store implementation |
| `cmd/gateway_troy_wiring.go` | Startup wiring: env config → client init → handler registration |
| `migrations/000074_asset_sessions.up.sql` | PostgreSQL migration (create table + indexes) |
| `migrations/000074_asset_sessions.down.sql` | PostgreSQL rollback |

### Backend — Modified Files (minimal touch)

| File | Change |
|------|--------|
| `internal/store/stores.go` | +1 field: `AssetSessions AssetSessionStore` |
| `internal/store/pg/factory.go` | +1 line: wire `NewPGAssetSessionStore` |
| `internal/store/sqlitestore/factory.go` | +1 line: wire `NewSQLiteAssetSessionStore` |
| `internal/store/sqlitestore/schema.sql` | +15 lines: table DDL at end of file |
| `internal/store/sqlitestore/schema.go` | +12 lines: migration step 42→43, bump SchemaVersion |
| `internal/upgrade/version.go` | 1 constant: `73` → `74` |
| `internal/gateway/server.go` | +4 lines: `SetTroyHandler` method |
| `cmd/gateway_http_wiring.go` | +1 line: call `wireTroyHandler(d)` |

### Frontend — New Files

| File | Purpose |
|------|---------|
| `ui/web/src/pages/troy/troy-page.tsx` | Main page: 5-column responsive layout with URL-driven state |
| `ui/web/src/pages/troy/troy-locations.tsx` | Locations list column with pagination |
| `ui/web/src/pages/troy/troy-assets.tsx` | Assets (devices) list + location header + action menu stubs |
| `ui/web/src/pages/troy/troy-sessions.tsx` | Chat thread list + agent picker for new sessions |
| `ui/web/src/pages/troy/troy-chat.tsx` | Chat column reusing existing chat components |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `ui/web/src/lib/routes.ts` | +2 constants: `TROY`, `TROY_PATTERN` |
| `ui/web/src/routes.tsx` | +3 lines: lazy import + Route element |
| `ui/web/src/components/layout/sidebar.tsx` | +2 lines: `Gauge` icon import + SidebarItem |

---

## Detailed Component Documentation

### 1. Troy External API Client (`internal/troy/client.go`)

**Responsibility:** Manages all communication with the external MyDevices/Spenergy platform.

#### OAuth Token Lifecycle

```
Startup:
  wireTroyHandler() → client.Authenticate(ctx)
    → POST /auth/realms/{realm}/protocol/openid-connect/token
    → grant_type=client_credentials
    → Stores: access_token, refresh_token, expires_at (with 60s safety buffer)

Runtime (per-request):
  ensureToken(ctx)
    ├─ Token valid? → return access_token (fast path, no network call)
    ├─ Token expired? → RefreshAuth(ctx)
    │   → POST .../token with grant_type=refresh_token
    │   └─ If refresh fails → fall back to full Authenticate()
    └─ No token? → Authenticate(ctx)
```

#### Company Resolution

At startup, the client paginates through `GET /v1.0/admin/companies` (50 per page) and finds the best match for `TROY_COMPANY_NAME` using this scoring:

| Score | Condition |
|-------|-----------|
| Exact | `strings.ToLower(api_name) == strings.ToLower(config_name)` → immediate return |
| 3 | API name starts with search term |
| 2 | API name contains search term |
| 1 | Search term contains API name |

The resolved company (with its numeric ID) is cached for the lifetime of the process.

#### Thread Safety

All token state is protected by `sync.RWMutex`. The `apiGet` method handles 401 responses with a single retry after re-authentication to prevent infinite loops.

### 2. HTTP Handler (`internal/http/troy.go`)

**Pattern:** Implements the codebase's `routeRegistrar` interface — same pattern as `AgentsHandler`, `SkillsHandler`, etc.

#### Endpoints

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/v1/troy/locations` | `page`, `limit` | `{ count, limit, page, rows: Location[] }` |
| GET | `/v1/troy/devices` | `location_id` (required), `page`, `limit` | `{ count, limit, page, rows: Device[] }` |
| GET | `/v1/troy/asset-sessions` | `asset_id`, `asset_type` (both required) | `{ sessions: AssetSession[] }` |
| POST | `/v1/troy/asset-sessions` | body: `{ assetId, assetType, sessionKey }` | `AssetSession` (201) |
| DELETE | `/v1/troy/asset-sessions/{id}` | — | 204 No Content |

All endpoints are auth-protected via the existing `requireAuth` middleware (same as all other GoClaw HTTP endpoints). Tenant scoping is automatic via `store.TenantIDFromContext(ctx)`.

### 3. Store Layer (`asset_sessions`)

#### Schema

```sql
-- PostgreSQL
CREATE TABLE asset_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    asset_id    TEXT NOT NULL,          -- external location_id or thing_id
    asset_type  TEXT NOT NULL,          -- 'location' or 'device'
    session_key TEXT NOT NULL,          -- references sessions.key
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
idx_asset_sessions_asset   (tenant_id, asset_id, asset_type)  -- list sessions for an asset
idx_asset_sessions_session (tenant_id, session_key)            -- reverse lookup
```

**Design decisions:**
- `asset_id` is TEXT (not INT) to accommodate both numeric location IDs and UUID device IDs from the external API
- `session_key` is a soft reference (not FK) to sessions — allows the association to survive session archival/deletion without cascade issues
- Tenant-scoped: every query filters by `tenant_id` from context

#### Interface

```go
type AssetSessionStore interface {
    Create(ctx context.Context, assetID, assetType, sessionKey string) (*AssetSession, error)
    ListByAsset(ctx context.Context, assetID, assetType string) ([]AssetSession, error)
    Delete(ctx context.Context, id uuid.UUID) error
}
```

### 4. Startup Wiring (`cmd/gateway_troy_wiring.go`)

**Activation criteria:** All three env vars must be set: `TROY_CLIENT_ID`, `TROY_CLIENT_SECRET`, `TROY_COMPANY_NAME`. If any are missing, Troy is silently disabled (debug log only).

**Startup sequence:**
1. Read env vars → build `troy.Config`
2. `client.Authenticate(ctx)` — fail → log error, return (no Troy endpoints)
3. `client.ResolveCompany(ctx)` — fail → log error, return
4. Check `d.pgStores.AssetSessions != nil` → register `TroyHandler`

**Failure mode:** If auth or company resolution fails at startup, the Troy endpoints are never registered. The rest of the gateway operates normally. This is the same pattern used by other optional features (workstations, webhooks, TTS).

### 5. Frontend Architecture

#### URL-Driven State (no dual state)

The Troy page uses React Router params as the single source of truth:

```
/troy                              → shows locations only
/troy/:locationId                  → shows locations + assets
/troy/:locationId/:assetId         → shows locations + assets + sessions
/troy/:locationId/:assetId/:sessionKey → shows all 4 columns + chat
```

This follows the codebase convention documented in AGENTS.md: "derive state from `useParams()` — do NOT duplicate into `useState`."

#### Component Hierarchy

```
TroyPage (layout orchestrator)
├── TroyLocations (fetches /v1/troy/locations, handles pagination)
├── TroyAssets (fetches /v1/troy/devices?location_id=X, shows location header)
├── TroySessions (fetches /v1/troy/asset-sessions, creates new sessions)
└── TroyChat (reuses ChatThread + ChatInput + ChatTopBar from existing chat page)
```

#### API Integration Pattern

Each column component uses the `useHttp()` hook (from `@/hooks/use-ws`) to make REST calls:

```typescript
const http = useHttp();
const result = await http.get<LocationsResponse>("/v1/troy/locations", {
  page: String(p),
  limit: "50",
});
```

This reuses the existing `HttpClient` which handles auth headers (`Authorization: Bearer ...`, `X-GoClaw-User-Id`, `X-GoClaw-Tenant-Id`) automatically.

#### Chat Reuse

`TroyChat` imports and reuses these existing components/hooks directly:
- `useChatMessages` — message loading, streaming, activity tracking
- `useChatSend` — send message logic
- `ChatThread` — message rendering with markdown, tool calls, streaming
- `ChatInput` — input with file attachments, abort button
- `ChatTopBar` — agent name, running indicator

No modifications to these components were needed.

---

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Troy external API configuration
TROY_AUTH_URL=https://auth.mydevices.com      # OAuth server base URL
TROY_API_URL=https://api.mydevices.com        # REST API base URL
TROY_REALM=spenergy                           # Keycloak realm name
TROY_CLIENT_ID=spenergy                       # OAuth client ID
TROY_CLIENT_SECRET=<secret>                   # OAuth client secret
TROY_COMPANY_NAME=Example Inc (Demo Site)     # Company name to resolve at startup
```

All are required for Troy to activate. `TROY_AUTH_URL`, `TROY_API_URL`, and `TROY_REALM` have defaults if not specified.

### Database Migration

**PostgreSQL:** Run `./goclaw migrate up` — applies `migrations/000074_asset_sessions.up.sql`.

**SQLite (Desktop):** Automatic — `EnsureSchema()` detects version < 43 and applies incremental migration.

---

## Data Flow Walkthrough

### Flow 1: User Opens Troy Page

```
1. User clicks "Troy" in sidebar
2. React Router renders TroyPage at /troy
3. TroyLocations mounts → GET /v1/troy/locations?page=0&limit=50
4. TroyHandler.handleLocations() → troy.Client.GetLocations(ctx, 0, 50)
5. Client.ensureToken() → token valid, proceed
6. Client.apiGet("/v1.0/admin/locations", {company_id: 40024, page: 0, limit: 50})
7. External API returns LocationsResponse
8. Handler writes JSON response to HTTP client
9. TroyLocations renders location list
```

### Flow 2: User Selects Location → Asset → Creates Chat

```
1. User clicks location → navigate(/troy/53033)
2. TroyAssets mounts → GET /v1/troy/devices?location_id=53033&page=0&limit=50
3. User clicks device → navigate(/troy/53033/d60c5cc0-...)
4. TroySessions mounts → GET /v1/troy/asset-sessions?asset_id=d60c5cc0-...&asset_type=device
5. User clicks "+" → AgentPickerModal opens
6. User enters agent ID → POST /v1/troy/asset-sessions
   Body: { assetId: "d60c5cc0-...", assetType: "device", sessionKey: "myagent-lxyz123" }
7. AssetSessionStore.Create() inserts row in asset_sessions table
8. TroySessions refetches list, selects new session
9. navigate(/troy/53033/d60c5cc0-.../myagent-lxyz123)
10. TroyChat mounts with sessionKey="myagent-lxyz123"
11. useChatMessages subscribes to WS events for that session
12. User sends message → useChatSend → existing agent pipeline executes
```

### Flow 3: Token Refresh (Transparent)

```
1. Access token expires after ~24h
2. Next API call → ensureToken() detects expiry
3. RefreshAuth() → POST /auth/realms/spenergy/protocol/openid-connect/token
   Body: grant_type=refresh_token&refresh_token=<saved>&client_id=...&client_secret=...
4. New access_token + refresh_token saved
5. Original API call proceeds with new token
6. If refresh fails → full Authenticate() with client_credentials
```

---

## Extensibility Points

### Future: Multi-Tenant Company Resolution

Currently, company is resolved once at startup from `TROY_COMPANY_NAME`. To make this multi-tenant:

1. Add `troy_company_name` to `tenant_configs` table
2. Resolve company per-tenant on first request (cache in memory with TTL)
3. Pass tenant-specific company ID to `GetLocations`/`GetDevices`

### Future: Analysis & Chart Menu Items

The `AssetMenu` component in `troy-assets.tsx` renders a `MoreVertical` icon with stub click handling. To add Analysis/Chart views:

1. Create `troy-analysis.tsx` and `troy-chart.tsx` components
2. Add a dropdown menu (Radix Popover) to `AssetMenu`
3. Use URL state or Zustand to toggle between Chat/Analysis/Chart views in the rightmost column

### Future: Real-Time Device Data

The current implementation fetches device lists on-demand. For real-time updates:

1. Subscribe to WebSocket events from the external API (if available)
2. Or poll on an interval and push updates via the existing GoClaw event bus
3. Frontend can listen via `ws.on("troy.device_update", handler)`

---

## Testing Strategy

### Backend

- **Unit tests:** Troy client can be tested with httptest.Server mocking the external API
- **Integration tests:** AssetSessionStore CRUD against test DB (same pattern as other stores in `tests/integration/`)
- **Build verification:** `go build ./...` and `go build -tags sqliteonly ./...` both pass

### Frontend

- **Type safety:** TypeScript compilation via `pnpm build` catches interface mismatches
- **Component testing:** Each Troy component is self-contained with clear props interfaces
- **E2E:** Troy endpoints need the external API running; use recorded responses for CI

---

## Rollback Plan

Troy is fully reversible:

1. **Disable without code change:** Remove `TROY_*` env vars → Troy handler never registers, sidebar item shows but API returns 404
2. **Full removal:**
   - Delete `internal/troy/`, `internal/http/troy.go`, `cmd/gateway_troy_wiring.go`
   - Delete `ui/web/src/pages/troy/`
   - Revert the 8 modified files (single-line additions each)
   - Run `./goclaw migrate down` to drop `asset_sessions` table
   - Revert `SchemaVersion` and `RequiredSchemaVersion`

---

## Conventions Followed

| Convention | Application |
|-----------|-------------|
| Store interface pattern | `AssetSessionStore` in `internal/store/`, implementations in `pg/` and `sqlitestore/` |
| Parameterized queries | `$1, $2` for PG, `?` for SQLite — no string concatenation |
| Tenant scoping | All queries include `WHERE tenant_id = $N` via `store.TenantIDFromContext(ctx)` |
| Dual-DB migrations | PG migration file + SQLite schema.sql + schema.go migration step |
| HTTP handler pattern | `routeRegistrar` interface, `requireAuth` middleware, `writeJSON`/`writeError` helpers |
| Server wiring | `SetXHandler` method on Server, called from `wireHTTPHandlersOnServer` |
| Frontend routing | URL params as source of truth, no dual state |
| Mobile-first | Responsive column visibility via `isMobile` + conditional rendering |
| Input font-size | `text-base md:text-sm` on inputs (prevents iOS zoom) |
| API calls | `useHttp()` hook for REST, typed responses |
