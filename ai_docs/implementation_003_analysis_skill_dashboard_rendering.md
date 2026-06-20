# Implementation: IoT Analytics Skill — Dashboard Rendering

## Overview

The IoT Data Analytics skill generates a React/JSX dashboard component (charts, metrics, insights) from device telemetry data. The LLM output is wrapped in an `<artifact>` tag, which the frontend detects, parses, and renders as a live interactive dashboard inside a modal dialog.

## Architecture

```
LLM generates:
  "Here's your dashboard ⚡\n<artifact type="react-ts" title="..." dependencies='{...}'>...JSX code...</artifact>"

Frontend pipeline:
  1. rich-content-parser.ts  → detects <artifact> tag, extracts code + metadata
  2. rich-content.tsx        → renders clickable "View Dashboard" link
  3. Dialog modal            → opens on click with toolbar (code/preview/copy/download)
  4. sandpack-runner.tsx     → renders JSX in sandboxed iframe using Babel + esm.sh
```

## Files Involved

### New Files Created

| File | Purpose |
|------|---------|
| `ui/web/src/components/chat/sandpack-runner.tsx` | Iframe-based JSX renderer (Babel + esm.sh) |
| `ui/web/src/stores/use-artifact-store.ts` | Zustand store for artifact state (used by streaming) |
| `ui/web/src/components/chat/artifact-panel.tsx` | Legacy side-panel (not actively used — modal approach preferred) |
| `skills/iot-data-analytics/SKILL.md` | Skill specification with output format and token budget |
| `skills/iot-data-analytics/templates/app-template.tsx` | Template the LLM follows for dashboard generation |
| `skills/iot-data-analytics/references/sandpack-integration.md` | Reference doc for artifact tag format |

### Modified Files

| File | Changes |
|------|---------|
| `ui/web/src/components/chat/rich-content-parser.ts` | Added `artifact` block type + regex extraction |
| `ui/web/src/components/chat/rich-content.tsx` | Added `ArtifactLink` component with Dialog modal |
| `ui/web/src/components/chat/streaming-text.tsx` | Strips artifact tags during streaming, shows badge |
| `ui/web/index.html` | CSP policy updated for iframe CDN scripts |

---

## Component Details

### 1. Artifact Tag Format (Backend → Frontend Protocol)

The LLM wraps generated code in this tag:

```html
<artifact type="react-ts" title="IoT Analytics Dashboard" dependencies='{"recharts":"^2.12.0","lucide-react":"^0.400.0"}'>
import React from "react";
// ... JSX component code ...
export default function App() { ... }
</artifact>
```

Attributes:
- `type` — template identifier (always `react-ts`)
- `title` — displayed in the modal header and clickable link
- `dependencies` — JSON of npm packages (single-quoted to avoid HTML attribute conflicts)

### 2. Parser (`rich-content-parser.ts`)

Two regex patterns handle both complete and truncated (token-limit exceeded) output:

```typescript
// Complete artifact with closing tag
const ARTIFACT_CLOSED_RE = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+dependencies='([^']*)')?\s*>([\s\S]*?)<\/artifact>/;

// Truncated artifact — no closing tag (LLM hit token limit)
const ARTIFACT_OPEN_RE = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+dependencies='([^']*)')?\s*>([\s\S]+)$/;
```

Extraction logic tries closed first, falls back to open:
```typescript
const artifactMatch = text.match(ARTIFACT_CLOSED_RE) ?? text.match(ARTIFACT_OPEN_RE);
```

The extracted block is added to the `RichBlock` union type:
```typescript
| { type: "artifact"; template: string; title: string; code: string; dependencies: Record<string, string> }
```

### 3. Chat Rendering (`rich-content.tsx`)

The `ArtifactLink` component renders as a clickable button in the chat message. On click, it opens a full-screen Dialog modal:

- **Preview mode** (default): renders the dashboard via `SandpackRunner` in an iframe
- **Code mode** (toggle): shows raw source code in a `<pre>` block
- **Copy button**: copies code to clipboard
- **Download button**: downloads as `App.tsx`

The component is self-contained with local state — no external store dependency.

### 4. Streaming Support (`streaming-text.tsx`)

During LLM streaming, the artifact tag content is stripped from displayed text to avoid showing raw code. A badge appears:

- "Generating dashboard…" — while artifact content is still streaming
- "View Dashboard" — once enough code is detected (>100 chars after opening tag)

Uses `useState` (not `useRef`) to trigger re-render when artifact becomes ready.

### 5. Dashboard Renderer (`sandpack-runner.tsx`)

**Approach: Iframe with Babel standalone + esm.sh CDN modules.**

This was chosen over Sandpack (`@codesandbox/sandpack-react`) because:
- Works on HTTP (no `crypto.subtle` requirement)
- Zero bundle size impact (no npm dependency)
- No external bundler server connection needed
- Simpler CSP management

**How it works:**

1. **React import injection** — prepends `import React from "react"` if missing
2. **TypeScript stripping** (safety net) — regex removes type annotations for backward compatibility with older messages that may contain TypeScript
3. **Import map** — maps `react`, `recharts`, `lucide-react` to esm.sh CDN URLs
4. **HTML generation** — builds a complete HTML document with:
   - TailwindCSS CDN for styling
   - Babel standalone for JSX → JavaScript transform
   - Import map for ESM module resolution
   - The component code in a `<script type="text/babel">` tag
5. **Blob URL** — creates a `blob:` URL from the HTML to bypass parent page CSP
6. **Sandboxed iframe** — renders with `sandbox="allow-scripts"` only (no `allow-same-origin` to prevent CSP inheritance)

```
┌─────────────────────────────────────┐
│ Parent Page (your app)              │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ iframe (sandbox="allow-scripts")│ │
│  │                               │  │
│  │  Babel transforms JSX → JS   │  │
│  │  esm.sh loads react/recharts │  │
│  │  TailwindCSS styles the UI   │  │
│  │  ReactDOM renders App()      │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 6. CSP Configuration (`index.html`)

The Content-Security-Policy meta tag was updated to allow the iframe's blob URL and CDN resources:

```
frame-src blob:;
script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://esm.sh 'unsafe-inline';
connect-src 'self' ws: wss: https://esm.sh https://cdn.esm.sh https://unpkg.com;
```

These additions are required because Chrome applies parent CSP to blob-URL iframes in some scenarios.

---

## Skill Output Constraints

The SKILL.md instructs the LLM to generate code that fits within token limits:

| Constraint | Value |
|------------|-------|
| Total artifact token budget | 4000 tokens |
| Language | JavaScript + JSX (NO TypeScript) |
| Data array `D` | Max 24 hourly objects, keys: `h`, `p`, `c` |
| Hour format | `"HH:00"` (e.g., `"01:00"`, `"13:00"`) |
| Summary object `S` | Max 6 numeric fields |
| Insights array `I` | Max 5 short sentences |
| Sections | Header, 4 metric cards, 2 charts, insights list |
| NOT included | Data tables, tabs, risk panels, area charts |

## Dependencies

The iframe approach requires **no npm dependencies**. The following are loaded at runtime inside the iframe only:

| Resource | CDN | Purpose |
|----------|-----|---------|
| Babel standalone | unpkg.com | JSX → JavaScript transform |
| TailwindCSS | cdn.tailwindcss.com | Utility CSS styling |
| React 18 | esm.sh | Component runtime |
| Recharts | esm.sh | Chart components |
| Lucide React | esm.sh | Icon components |

## Data Flow Summary

```
1. User asks: "analyze the device data"
2. Agent activates iot-data-analytics skill
3. Skill runs Python analysis (analyze.py) → statistics
4. LLM generates JSX dashboard with inline data
5. LLM wraps in <artifact type="react-ts" ...>code</artifact>
6. Backend streams response to frontend
7. streaming-text.tsx strips artifact, shows badge
8. After stream ends, message renders via rich-content-parser
9. Parser extracts artifact → ArtifactLink button appears in chat
10. User clicks → Dialog opens → iframe renders dashboard
```
