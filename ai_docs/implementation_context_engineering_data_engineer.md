# Dynamic Context Injection for IoT Data Engineering Workflow

## Overview

This document describes the design and implementation of a session-aware dynamic context injection system that supports a two-phase IoT data engineering workflow:

- **Phase 1 (Data Preparation):** The LLM activates the `iot-data-engineering` skill to fetch device telemetry, generate a device-specific extraction script, execute it in a sandbox container, and produce `data.csv` + `metadata.json`.
- **Phase 2 (Analytics):** On subsequent turns, the platform injects the data summary into the system prompt so the LLM can answer analytical queries using the pre-built CSV without re-fetching.

The platform manages session state; the LLM is stateless and responds to whatever context is in front of it.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ UI: User selects device → creates asset-session association        │
│ POST /v1/troy/asset-sessions → SetSessionMetadata(iot_device_id)   │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ Pipeline Run (every user message)                                  │
│                                                                    │
│  ContextStage (setup, runs once per pipeline run):                 │
│    Step 4:   BuildMessages() → system prompt assembled             │
│    Step 4.1: InjectSessionState() → reads session metadata         │
│              ├── iot_data_ready=false → inject Phase 1 context     │
│              └── iot_data_ready=true  → inject data summary        │
│    Step 5:   Token counting                                        │
│    Step 8:   AutoInject (memory)                                   │
│                                                                    │
│  Iteration Loop:                                                   │
│    ThinkStage → PruneStage → ToolStage → ObserveStage → Checkpoint│
│    (LLM may activate skill → exec in sandbox → writes files)       │
│                                                                    │
│  FinalizeStage (runs once after loop):                             │
│    Step 5.1: DetectSessionState() → reads workspace/output/        │
│              metadata.json from host filesystem → stores in         │
│              session metadata if new/changed                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## Session State Lifecycle

| Session Metadata Key     | Set By                     | Description                                   |
|--------------------------|----------------------------|-----------------------------------------------|
| `iot_device_id`          | HTTP handler (troy.go)     | Device UUID, set when asset-session is created |
| `iot_data_ready`         | DetectSessionState         | `"true"` when metadata.json exists            |
| `iot_metadata_summary`   | DetectSessionState         | JSON content of metadata.json (max 2KB)       |

### State Transitions

```
Session Created (UI selects device):
  { iot_device_id: "d60c..." }

After Phase 1 completes (LLM runs skill → metadata.json produced):
  { iot_device_id: "d60c...", iot_data_ready: "true", iot_metadata_summary: "{...}" }

Re-trigger (user changes time range → LLM re-runs skill → metadata.json overwritten):
  { iot_device_id: "d60c...", iot_data_ready: "true", iot_metadata_summary: "{new...}" }
```

---

## System Prompt Injection

### When `iot_data_ready` is NOT set (Phase 1)

The system prompt gets this appended after the main prompt:

```
## Session State
data_ready: false
device_id: d60c5cc0-5931-11f1-94d3-297a7f671e3c

On the first user message, use the iot-data-engineering skill to prepare analytics data for this device.
Extract start_time and end_time from the user's message. Default: last 30 days if not specified.
```

### When `iot_data_ready` is `"true"` (Phase 2)

```
## Session State
data_ready: true
device_id: d60c5cc0-5931-11f1-94d3-297a7f671e3c

## Data Summary
{"columns": {"timestamp": {...}, "power_kw": {...}}, "device_info": {...}, "row_count": 1344}

Data file is available at /output/data.csv in the sandbox. Use it for analytics queries.
Do NOT re-fetch from the API unless the user explicitly changes the time range.
```

---

## Sandbox Configuration

The sandbox container runs the data engineering skill's generated Python scripts.

### Required `sandbox_config` (per-agent or global)

```json
{
  "sandbox_config": {
    "mode": "all",
    "image": "goclaw-sandbox:bookworm-slim",
    "network_enabled": true,
    "workspace_access": "rw",
    "env": {
      "MYDEVICES_TOKEN": "<jwt-token>"
    },
    "setup_command": "pip3 install pandas pytz requests"
  }
}
```

Key settings:
- `network_enabled: true` — required for API calls to myDevices
- `workspace_access: "rw"` — output files written to workspace are visible on host
- `env.MYDEVICES_TOKEN` — injected at container creation via `docker run -e`
- `setup_command` — installs Python dependencies once after container creation

### File Locations

| Container Path         | Host Path                        | Purpose                |
|------------------------|----------------------------------|------------------------|
| `/workspace/output/data.csv`     | `{workspace}/output/data.csv`     | Analytics-ready CSV    |
| `/workspace/output/metadata.json`| `{workspace}/output/metadata.json`| Column descriptions    |

The volume mount (`-v hostPath:/workspace:rw`) makes files bidirectionally visible. `DetectSessionState` reads from the host path; the LLM executes code against the container path.

---

## Code Changes

### 1. `internal/pipeline/deps.go` — New callback declarations

```go
// Context callbacks (ContextStage)
InjectSessionState func(ctx context.Context, input *RunInput) (string, error)

// Finalize callbacks (FinalizeStage)
DetectSessionState func(ctx context.Context, sessionKey string)
```

`InjectSessionState` returns a string to append to the system prompt. Empty string = no injection.
`DetectSessionState` is fire-and-forget; errors are swallowed (best-effort state detection).

### 2. `internal/pipeline/context_stage.go` — Step 4.1 injection point

After `BuildMessages` sets the system message (step 4), a new step 4.1 calls `InjectSessionState`:

```go
// 4.1. Inject dynamic session state into system prompt.
if s.deps.InjectSessionState != nil {
    section, err := s.deps.InjectSessionState(ctx, state.Input)
    if err == nil && section != "" {
        sys := state.Messages.System()
        sys.Content += "\n\n" + section
        state.Messages.SetSystem(sys)
    }
}
```

This runs AFTER the full system prompt is built (including persona, tools, skills, context files) but BEFORE token counting and memory auto-inject. This means:
- The injected section is included in overhead token calculation (step 5)
- It's placed below the cache boundary (dynamic, per-turn content)

### 3. `internal/pipeline/finalize_stage.go` — Step 5.1 state detection

After session metadata update (step 5), calls `DetectSessionState`:

```go
// 5.1. Detect session state changes.
if s.deps.DetectSessionState != nil {
    s.deps.DetectSessionState(ctx, state.Input.SessionKey)
}
```

### 4. `internal/agent/loop_pipeline_callbacks.go` — Callback implementations

Two new maker functions added:

**`makeInjectSessionState`** — Reads session metadata and returns appropriate context:
- If `iot_device_id` is empty → returns `""` (not an IoT session, no injection)
- If `iot_data_ready != "true"` → returns Phase 1 instructions with device_id
- If `iot_data_ready == "true"` → returns data summary section

**`makeDetectSessionState`** — Checks host filesystem for metadata.json:
- Skips if no `iot_device_id` in session metadata (not an IoT session)
- Reads `{workspace}/output/metadata.json`
- Truncates to 2KB to avoid bloating session metadata storage
- Compares with stored value; updates only if content changed (handles re-triggers)

New imports: `"os"`, `"path/filepath"`

### 5. `internal/agent/loop_pipeline_adapter.go` — Wiring

```go
// Context callbacks
InjectSessionState: cb.injectSessionState,

// Finalize callbacks
DetectSessionState: cb.detectSessionState,
```

### 6. `internal/http/troy.go` — Initial session metadata seeding

In `handleCreateAssetSession`, after creating the asset-session association:

```go
if body.AssetType == "device" && h.sessions != nil {
    h.sessions.SetSessionMetadata(r.Context(), body.SessionKey, map[string]string{
        "iot_device_id": body.AssetID,
    })
}
```

This seeds the device context immediately when the UI associates a device with a chat session.

### 7. `skills/iot-data-engineering/SKILL.md` — Time range instructions

Added explicit instructions for time range resolution:

```markdown
### Time Range Resolution

The platform does NOT provide start/end times — you must extract them from the user's message:
- "last 2 weeks" → end=now, start=now minus 14 days
- "last 3 months" → end=now, start=now minus 90 days
- "from January to March" → convert to epoch ms
- **Default: last 30 days** if the user does not mention any time range
- Always convert to epoch milliseconds for the API call
```

---

## Session Flow (Complete Example)

### 1. User selects device in UI

```
POST /v1/troy/asset-sessions
Body: { "assetId": "d60c5cc0-...", "assetType": "device", "sessionKey": "agent:troy:ws:direct:user1:sess1" }

→ Creates AssetSession row
→ SetSessionMetadata("agent:troy:...", { "iot_device_id": "d60c5cc0-..." })
```

### 2. First message: "Show me power consumption for last 2 weeks"

**ContextStage:**
- `InjectSessionState` reads metadata → `iot_data_ready` not set
- Injects Phase 1 context: `data_ready: false, device_id: d60c5cc0-...`

**LLM response:**
- Sees device_id + skill instructions
- Extracts time range: end=now, start=now-14days (epoch ms)
- Generates Python script using pipeline.py as reference
- Calls `exec` tool to run in sandbox
- Script produces `/workspace/output/data.csv` + `/workspace/output/metadata.json`

**FinalizeStage:**
- `DetectSessionState` finds `{workspace}/output/metadata.json` on host
- Stores in session metadata: `iot_data_ready=true`, `iot_metadata_summary=<json>`

### 3. Second message: "What's the average power?"

**ContextStage:**
- `InjectSessionState` reads metadata → `iot_data_ready=true`
- Injects: data summary + "Data file available at /output/data.csv"

**LLM response:**
- Sees column metadata in context (knows `power_kw` column exists)
- Writes Python: `df = pd.read_csv('/output/data.csv'); print(df['power_kw'].mean())`
- Executes in sandbox → returns result

### 4. Re-trigger: "Now show me last 6 months"

**LLM response:**
- Detects time range change in user message
- Re-activates skill → generates new script with 6-month range
- Overwrites `/workspace/output/data.csv` + `metadata.json`

**FinalizeStage:**
- `DetectSessionState` reads new metadata.json → content differs → updates session metadata

### 5. Next turn uses updated data summary automatically

---

## Design Decisions

### Why session metadata (not a new table)?

Session metadata (`map[string]string`) already exists, is per-session scoped, and requires zero schema changes. The 2KB truncation limit prevents storage bloat. For more complex state (versioning, history of time ranges), a dedicated table would be needed — but for this workflow, metadata is sufficient.

### Why host filesystem detection (not sandbox exec)?

The sandbox manager lives on the tools layer and isn't directly accessible from the agent Loop. Since `workspace_access: "rw"` creates a bidirectional Docker volume mount, files in the container's `/workspace/` are immediately visible on the host at the workspace path. Reading from the host is simpler, requires no new dependencies, and avoids the complexity of obtaining a sandbox reference in the pipeline.

### Why inject after BuildMessages (step 4.1)?

- **After** the full system prompt is built → doesn't interfere with prompt mode, context file filtering, or cache boundary logic
- **Before** token counting (step 5) → injected tokens are correctly counted in overhead budget
- **Before** memory auto-inject (step 8) → memory recall can still be appended separately
- Placed in the **dynamic section** (below cache boundary) → won't bust Anthropic prompt cache on content changes

### Why re-read metadata.json every run in DetectSessionState?

To handle re-triggers without requiring the LLM to explicitly signal state changes. When the user says "now show me last 6 months", the LLM simply re-runs the skill (overwrites files). The platform detects the change by comparing file content with stored metadata. This is a content-addressed approach — no coordination protocol needed between LLM and platform.

### Why is time range LLM-managed?

Time range extraction from natural language ("last 2 weeks", "from January to March 2024") is exactly what LLMs excel at. Implementing a regex/NLP parser in Go would be fragile and limited. The LLM reads the user's message, determines the time range, and passes it as CLI arguments to the generated script. The platform never needs to know the specific dates — it only cares whether data exists or not.

---

## Files Modified

| File | Change |
|------|--------|
| `internal/pipeline/deps.go` | Added `InjectSessionState` and `DetectSessionState` callback declarations |
| `internal/pipeline/context_stage.go` | Added step 4.1: call InjectSessionState after BuildMessages |
| `internal/pipeline/finalize_stage.go` | Added step 5.1: call DetectSessionState after metadata update |
| `internal/agent/loop_pipeline_callbacks.go` | Added `makeInjectSessionState`, `makeDetectSessionState` implementations; added `os`, `path/filepath` imports; added fields to `pipelineCallbackSet` struct |
| `internal/agent/loop_pipeline_adapter.go` | Wired `InjectSessionState` and `DetectSessionState` in `buildPipelineDeps` |
| `internal/http/troy.go` | Seeds `iot_device_id` in session metadata on asset-session creation |
| `skills/iot-data-engineering/SKILL.md` | Added Time Range Resolution section with extraction rules and 30-day default |

---

## Testing Considerations

### Unit test: InjectSessionState

- Session with no metadata → returns `""`
- Session with `iot_device_id` but no `iot_data_ready` → returns Phase 1 section
- Session with `iot_data_ready=true` + summary → returns Phase 2 section
- Session with `iot_data_ready=true` but empty summary → returns `""`

### Unit test: DetectSessionState

- No `iot_device_id` in metadata → no-op
- metadata.json doesn't exist → no-op
- metadata.json exists, not previously stored → sets `iot_data_ready=true`
- metadata.json unchanged from stored → no update
- metadata.json changed (re-trigger) → updates `iot_metadata_summary`

### Integration test: Full flow

- Create asset-session → verify metadata seeded
- First pipeline run (mock skill execution, write metadata.json to workspace)
- Verify DetectSessionState captures it
- Second pipeline run → verify InjectSessionState returns data summary
- Overwrite metadata.json → verify re-detection

### Manual test: Sandbox

- Verify `network_enabled: true` allows API calls from container
- Verify `MYDEVICES_TOKEN` env var is accessible inside container
- Verify files written to `/workspace/output/` are visible on host



The Bug
  
  When sandbox is enabled (mode: "all"), the read_file and list_files tools route all file
  operations into the Docker container via docker exec cat <path>. But skill files live on the
  host at /home/bipulk/.goclaw/data/skills-store/... — this path is not mounted into the
  container (only ~/.goclaw/workspace/ is mounted at /workspace).
  
  So when the LLM calls:
  
  read_file(path: "/home/bipulk/.goclaw/data/skills-store/iot-data-engineering/1/SKILL.md")
  
  The tool tries to resolve this absolute path inside the container → it's outside the
  container's CWD → falls back to the CWD (/workspace/writer/ws/system) → cat on a directory →
  error.
  
  The Fix
  
  In read_file and list_files, before routing to sandbox, check if the path matches any
  allowedPrefixes (which already include skills-store dirs, CLI workspaces, etc.). If it does,
  skip sandbox and read directly from the host:
  
  // Before (unconditional sandbox routing):
  if t.sandboxMgr != nil && sandboxKey != "" {
      return t.executeInSandbox(...)
  }
  
  // After (skip sandbox for host-only paths):
  if t.sandboxMgr != nil && sandboxKey != "" && !t.isHostOnlyPath(path) {
      return t.executeInSandbox(...)
  }
  
  isHostOnlyPath returns true for absolute paths that start with any registered allowedPrefixes
   — these are paths configured at startup that only exist on the host (skills-store,
  ~/.agents/skills, builtin skills, etc.).
  
  Result
  
  - read_file("/home/bipulk/.goclaw/data/skills-store/.../SKILL.md") → host filesystem ✓
  - read_file("data.csv") or read_file("/workspace/output/data.csv") → sandbox container ✓
  
  Files Changed
  
  - internal/tools/filesystem.go — added bypass + isHostOnlyPath method on ReadFileTool
  - internal/tools/filesystem_list.go — same for ListFilesTool
