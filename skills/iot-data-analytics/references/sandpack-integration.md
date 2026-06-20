# Sandpack Integration Configuration

This document describes the Sandpack browser environment used to render the LLM-generated analytics dashboard component.

## Template

The Sandpack instance uses the `react-ts` template, which provides TypeScript support with React out of the box.

```
template: "react-ts"
```

## Dependencies

The following `customSetup.dependencies` are configured in the Sandpack instance:

```json
{
  "recharts": "^2.12.0",
  "lucide-react": "^0.400.0"
}
```

These are the **only** additional packages available beyond what the `react-ts` template provides by default (`react`, `react-dom`, and their type definitions).

## Allowed Imports

The LLM-generated component may **only** import from these packages:

| Package | Source | Usage |
|---------|--------|-------|
| `react` | `react-ts` template | Component lifecycle, hooks, JSX |
| `react-dom` | `react-ts` template | Entry point rendering (used by `index.tsx`) |
| `recharts` | `customSetup.dependencies` | Charts and data visualization |
| `lucide-react` | `customSetup.dependencies` | Icon components for UI elements |

TailwindCSS is loaded via CDN and does **not** require an import statement — utility classes are used directly in `className` attributes.

### Import Examples

```tsx
// ✅ Allowed imports
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { Activity, Zap, TrendingUp, AlertTriangle, Clock, Battery } from "lucide-react";

// ❌ NOT allowed — will cause Sandpack render failure
import axios from "axios";
import * as d3 from "d3";
import { format } from "date-fns";
```

If the LLM-generated component contains an import from a package not in the allowed set, the Sandpack environment will fail to render the component. No additional packages may be installed at runtime.

## TailwindCSS v3 — CDN Loading

TailwindCSS v3 is loaded via a `<script>` tag in the `index.html` file provided to Sandpack. This enables the use of Tailwind utility classes without requiring a build step or PostCSS configuration.

## File Mapping

The Sandpack instance contains three files:

| Sandpack Path | Source | Description |
|---------------|--------|-------------|
| `/App.tsx` | LLM output | The generated analytics dashboard component |
| `/index.tsx` | Frontend (static) | Entry point that renders the App component |
| `/index.html` | Frontend (static) | HTML shell with TailwindCSS CDN script |

The LLM output maps directly to `/App.tsx`. The frontend supplies `/index.tsx` and `/index.html` as static files that do not change between renders.

## Frontend-Supplied Files

### `/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Analytics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### `/index.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Constraints

The Sandpack environment imposes the following constraints on the LLM-generated component:

| Constraint | Reason |
|-----------|--------|
| **No network requests** | `fetch`, `XMLHttpRequest`, `axios`, etc. are not permitted. All data must be embedded inline. |
| **No file system access** | Node.js `fs` module and file APIs are not available in the browser sandbox. |
| **No dynamic imports** | `import()` expressions are not supported. All imports must be static top-level statements. |
| **No additional packages** | Only `react`, `react-dom`, `recharts`, and `lucide-react` are available. Any other import will cause a render failure. |

### Constraint Code Examples

```tsx
// ❌ No network requests
const response = await fetch("https://api.example.com/data");

// ❌ No file system access
import fs from "fs";
const data = fs.readFileSync("./data.csv");

// ❌ No dynamic imports
const Chart = await import("./DynamicChart");

// ❌ No additional packages
import moment from "moment";
import _ from "lodash";

// ✅ Correct approach — embed data inline
const DATA = [
  { timestamp: "2026-06-12T09:00:00-04:00", power_kw: 1.44, energy_total_kwh: 52400.5 },
  { timestamp: "2026-06-12T10:00:00-04:00", power_kw: 1.52, energy_total_kwh: 52401.9 },
  // ...
];
```

## Summary

The complete Sandpack configuration:

```json
{
  "template": "react-ts",
  "customSetup": {
    "dependencies": {
      "recharts": "^2.12.0",
      "lucide-react": "^0.400.0"
    }
  },
  "files": {
    "/App.tsx": "<LLM-generated component>",
    "/index.tsx": "<static entry point>",
    "/index.html": "<static HTML with TailwindCSS CDN>"
  }
}
```

## LLM Output Format — Artifact Tag

The LLM MUST wrap the generated `App.tsx` content in an `<artifact>` tag. This tag is parsed by the frontend to render a live Sandpack preview inline in the chat.

### Format

```
<artifact type="react-ts" title="IoT Analytics Dashboard" dependencies='{"recharts":"^2.12.0","lucide-react":"^0.400.0"}'>
export default function App() {
  // ... component code ...
}
</artifact>
```

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Sandpack template (`react-ts`) |
| `title` | string | Yes | Displayed in the artifact toolbar header |
| `dependencies` | JSON string (single-quoted) | Yes | Additional npm packages for `customSetup.dependencies` |

### Rules

- The `dependencies` value uses **single quotes** around the JSON to avoid conflicting with the HTML attribute double quotes
- Content between tags is the raw TypeScript source — no additional wrapping needed
- Only ONE artifact tag per message
- Any text outside the artifact tag renders as normal markdown alongside the preview
