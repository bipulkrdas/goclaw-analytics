---
name: iot-data-analysis
description: >
  Analyze IoT device telemetry from data.csv and metadata.json to produce
  a self-contained React/TypeScript analytics dashboard. Computes summary
  statistics, trends, anomalies, and generates a single App.tsx file
  renderable in a Sandpack react-ts environment with Recharts and TailwindCSS.
allowed-tools: ["Bash", "TextEditor", "Skill"]
---

# IoT Data Analysis Skill

## When to Use

Activate this skill when the user's request contains any of the following trigger phrases (case-insensitive):

- **analyse** / **analyze** — any form of data analysis request
- **report** — generate an analytics report
- **show trends** — visualize trends over time
- **visualize** — create visual representations of data
- **dashboard** — build an analytics dashboard
- **insights** — extract insights from device data
- **patterns** — identify patterns in telemetry
- **summarize data** — produce a summary of device readings

### Activation Conditions

1. The user's request contains at least one trigger phrase as a case-insensitive substring
2. A Data Engineering output (`data.csv` and `metadata.json`) exists in the working context
3. If trigger phrase is present but no data engineering output exists, invoke the data engineering skill first to produce the required files
4. If no trigger phrase is present, do NOT activate this skill unless the user explicitly requests it by name

## Inputs

This skill consumes exactly two files produced by the Data Engineering skill pipeline:

| File | Format | Location |
|------|--------|----------|
| `data.csv` | CSV with header row | Data engineering `--output-dir` directory |
| `metadata.json` | JSON object | Same directory as `data.csv` |

### data.csv

- First row is a header containing column names (snake_case with unit suffix)
- Each subsequent row is one device reading at a point in time
- Rows are ordered chronologically (oldest first)
- First column is always `timestamp` (ISO 8601 in device-local timezone)
- Available columns depend on device type — use `metadata.json` to determine which exist

### metadata.json

Contains four top-level fields:

- **`columns`** — map of column name → `{ description, unit, timezone?, source_channel?, source_name?, values? }`
- **`device_info`** — `{ device_id, device_name, device_type, sensor_type, timezone, voltage_setting, power_factor, multiplier, reading_interval_minutes }`
- **`row_count`** — integer count of data rows (excluding header)
- **`time_range`** — `{ start, end }` ISO 8601 timestamps in device-local timezone

### Column Type Classification

Determine column type from the `unit` field in metadata:

| Unit Value | Type Category | Analysis Treatment |
|------------|---------------|-------------------|
| `kWh` | numeric | Full stats + cost projection |
| `kW` | numeric | Full stats + peak detection |
| `A` | numeric | Full stats |
| `V` | numeric | Full stats + deviation alerts |
| `°F` | numeric | Full stats + overheating alerts |
| `duration` | duration | Convert HH:MM:SS to hours, then stats |
| `enum` | enum | Frequency counts, uptime % |
| `ISO 8601` | timestamp | Independent variable (x-axis) |

## Analysis Steps

Perform the following statistical operations in order. Skip any operation whose required columns are not present in the dataset.

### Step 1: Summary Statistics

For each **numeric** column (unit: kWh, kW, A, V, °F), compute:

- **Mean** — arithmetic average
- **Median** — 50th percentile value
- **Min** — minimum observed value
- **Max** — maximum observed value
- **Standard deviation** — population standard deviation

If a numeric column has fewer than 3 data points, skip statistical analysis for that column and note "insufficient data".

### Step 2: Trend Detection (Linear Regression)

For each numeric column, compute a linear regression of values against timestamp (converted to sequential numeric index):

- **Slope** — rate of change per reading interval
- **p-value** — statistical significance of the slope
- **Direction** — classify as:
  - `"increasing"` if slope > 0 AND p-value < 0.05
  - `"decreasing"` if slope < 0 AND p-value < 0.05
  - `"stable"` if p-value ≥ 0.05

### Step 3: Anomaly Detection (>2σ)

For each numeric column, identify individual data points whose values exceed two standard deviations from the column mean:

- A point is an **anomaly** if `|value - mean| > 2 * std`
- Record: index, timestamp, value, z-score for each anomaly
- If standard deviation is 0 (no variance), skip anomaly detection for that column

### Step 4: Peak Usage Periods (Top-3 Hourly)

For each power and energy column (unit: kW, kWh):

1. Group readings into 1-hour intervals based on timestamp
2. Compute the average value within each hourly interval
3. Select the **top 3** intervals with the highest average value
4. Report: hour start time, average value

Return exactly `min(3, number_of_distinct_hours)` entries.

### Step 5: Uptime Percentage

If a `device_status` column exists (unit: enum):

- Count readings with status `"Normal"`
- Calculate: `uptime_percent = (count_Normal / total_readings) * 100`

If no `device_status` column exists, compute uptime from current/power columns:

- Uptime = proportion of readings where `current_a > 0` or `power_kw > 0`

### Step 6: Energy Cost Projections

If energy columns exist (`energy_total_kwh`, `energy_last_hour_kwh`, or `energy_last_24h_kwh`):

1. **Total consumption** — compute the net energy consumed over the time range (max - min of `energy_total_kwh`, or sum of `energy_last_hour_kwh`)
2. **Hourly rate** — total consumption divided by total hours in the time range
3. **Cost projection** — multiply total consumption by the user-provided rate (default: **$0.12 USD/kWh** if no rate specified)
4. **Monthly projection** — extrapolate hourly rate to 720 hours (30 days)

If no energy columns exist, skip this step entirely.

## Output Specification

The final output MUST be wrapped in an `<artifact>` tag that the frontend uses to render a live Sandpack preview. The tag carries the sandpack configuration as attributes so the frontend can render without hardcoding skill-specific knowledge.

### Artifact Tag Format

```
<artifact type="react-ts" title="IoT Analytics Dashboard" dependencies='{"recharts":"^2.12.0","lucide-react":"^0.400.0"}'>
// ... entire App.tsx content here ...
</artifact>
```

**Attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `type` | Yes | Sandpack template name (always `react-ts` for this skill) |
| `title` | Yes | Human-readable title displayed in the artifact toolbar |
| `dependencies` | Yes | JSON object of npm packages beyond what the template provides (single-quoted) |

The content between the opening and closing `<artifact>` tags is the complete `App.tsx` source — a single default-exported React component.

### Structure

```typescript
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, Zap, TrendingUp, Clock } from "lucide-react";

const D=[{h:"01:00",p:100,c:0.8},{h:"02:00",p:34,c:0.3},...]; // max 24 hourly objects
const S={energy:0.4,avgPwr:74,peakA:10,uptime:14.5,readings:200,hours:11};
const I=["Finding 1.","Finding 2.","Finding 3."];

export default function App(){
  return(
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header: device name + time range */}
      {/* 4 Metric Cards */}
      {/* LineChart: power+current trend */}
      {/* BarChart: hourly distribution */}
      {/* Insights: numbered list */}
    </div>
  );
}
function Card({icon,label,value,color}:{icon:React.ReactNode;label:string;value:string;color:string}){...}
```

**Key rules for the structure:**
- ONE data array `D` reused for both charts (hourly aggregates)
- ONE summary object `S` for metric cards
- ONE insights array `I` (3–5 strings combining insights + risks)
- NO separate table data, risk data, or per-minute arrays
- Helper `Card` component defined at bottom of file

### Allowed Imports

The component may ONLY import from these packages:

| Package | Usage |
|---------|-------|
| `react` | Component lifecycle, hooks, JSX |
| `recharts` | Charts and data visualization |
| `lucide-react` | Icon components for UI elements |

TailwindCSS utility classes are used directly in `className` attributes (loaded via CDN, no import needed).

**No other imports are permitted.** Any import from a package not in this list will cause a Sandpack render failure.

### Constraints

- **Output language: JavaScript JSX (NOT TypeScript)** — no type annotations, no interfaces, no generics, no `as` casts. Plain `.jsx` compatible code only.
- **No network requests** — all data must be embedded inline as JavaScript constants
- **No file system access** — no `fs`, no file APIs
- **No dynamic imports** — all imports must be static top-level statements
- **No additional packages** — only react, recharts, and lucide-react
- **Single file** — everything in one `App.tsx` (helper components and utilities defined in same file)
- **No TypeScript syntax** — no `: string`, no `React.ReactNode`, no `interface`, no `type`. The file extension is `.tsx` but content must be valid JavaScript + JSX only.

### Large Dataset Handling

To keep the generated App.tsx within LLM output token limits, aggressively reduce inline data:

- **Trend charts (LineChart/AreaChart):** Always aggregate to **1-hour resolution**. Group raw readings into 1-hour buckets and compute the mean of each numeric column per bucket. Embed only the hourly aggregates — never raw per-minute data. Example: 12 hours of 5-minute data (144 rows) becomes 12 hourly data points.
- **Distribution chart (BarChart by hour-of-day):** Already hourly by design — no change needed.
- **Data table:** Show the most recent **20 readings** (not 50). This is raw data for detail inspection.
- **Maximum inline data points:** The total number of objects across ALL embedded arrays (DATA, TABLE_DATA, etc.) must not exceed **50 objects**. If hourly aggregation still exceeds 50 points, further downsample by taking every Nth bucket.
- **Numeric precision:** Round ALL numeric values to **1 decimal place** in embedded data (reduces JSON size significantly).
- **Variable names:** Use short variable names for data constants (`D` instead of `DATA`, `S` instead of `SUMMARY`) to save tokens.
- **Minify embedded JSON:** No extra whitespace in data arrays — use compact single-line JSON.

### Token Budget Awareness

The entire `<artifact>` content (opening tag through `</artifact>` closing tag) MUST fit within **4000 tokens**. This is a HARD LIMIT — truncation renders the dashboard broken.

**Budget breakdown:**
- Imports + helpers: ~300 tokens
- Data arrays (`D`, `S`, `I`): ~1500 tokens max
- JSX component body: ~2000 tokens
- Safety margin for closing tag: ~200 tokens

**To stay within budget:**
- `D` array: max 12–24 objects with 2-3 short keys each (e.g. `{h:"09",p:1.6,c:13.4}`)
- `S` object: max 6 numeric fields
- `I` array: max 5 short sentences
- No pretty-printing — minify data on single lines
- No TypeScript type annotations on data constants (use `any` or omit)
- Reuse `D` for both charts — do NOT create separate arrays
- The `</artifact>` closing tag MUST appear. Budget for it.

## Sandpack Configuration

The generated component renders in a Sandpack browser environment with the following configuration:

### Template

```
react-ts
```

### Dependencies (customSetup)

```json
{
  "recharts": "^2.12.0",
  "lucide-react": "^0.400.0"
}
```

### File Mapping

| Sandpack Path | Source | Description |
|---------------|--------|-------------|
| `/App.tsx` | LLM output | The generated analytics dashboard component |
| `/index.tsx` | Frontend (static) | Entry point rendering the App component |
| `/index.html` | Frontend (static) | HTML shell with TailwindCSS CDN script |

### Frontend-Supplied Files

**`/index.html`**:
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

**`/index.tsx`**:
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

## Dashboard Sections

The generated App.tsx MUST include exactly these 4 sections. No tabs, no table, no risk panel. Keep it simple to stay within token budget.

### 1. Header

- Device name (from `metadata.json → device_info.device_name`)
- Time range + reading count + hours covered (single line)
- Example: "Jun 14, 2026 01:00–12:00 EDT · 200 readings · 11 hours"

### 2. Metric Cards (4 cards max)

A 2x2 (mobile) / 4-col (desktop) grid with:

- **Total Energy** (kWh)
- **Average Power** (kW)
- **Peak Current** (A)
- **Uptime** (%)

Use a simple `Card` helper component defined in the same file.

### 3. Charts (2 charts only)

**Chart 1 — Line chart** showing power and/or current over time:
- Data: hourly aggregated array `D` (max 24 objects with keys `h`, `p`, `c`)
- `h` field uses `"HH:00"` format (e.g. `"01:00"`, `"13:00"`, `"22:00"`) for clear time display
- Use `ResponsiveContainer`, `LineChart`, dual Y-axis if showing 2 metrics

**Chart 2 — Bar chart** showing hourly power distribution:
- Reuse the same `D` array
- Simple `BarChart` with one `Bar`

### 4. Insights (text list)

- 3–5 bullet findings as a simple numbered list
- Combine insights AND risk flags into one list (no separate risk section)
- Each finding is one sentence

### Sections NOT included (to save tokens)

- ❌ Data table (too many tokens for row data)
- ❌ Separate risk analysis panel
- ❌ Tabs / navigation
- ❌ Area charts / energy cumulative chart
- ❌ Temperature chart

## Error Handling

### Missing Input Files

If `data.csv` or `metadata.json` does not exist in the expected output directory:

1. Invoke the **data engineering skill** with the user-provided device_id and time range
2. Wait for pipeline completion
3. Proceed with analysis once both files are available

### Empty Data

If the data engineering skill produces a `data.csv` with zero data rows:

1. Report to the user: "No data available for the specified device and time range"
2. Include the device name and time range in the message
3. Do NOT proceed with analysis or generate a dashboard component

### Insufficient Columns

If a required column for a specific analysis step is not present:

- **Skip that analysis step** for the missing column
- Do NOT error or halt the entire analysis
- Omit the corresponding metric from the dashboard section
- Document which sections were skipped in the Insights section

### Data Engineering Failure

If the data engineering skill invocation fails:

1. Report the failure to the user with an indication of the cause
2. Do NOT proceed with analysis

### Column Data Insufficient

If a numeric column contains fewer than 3 data points:

- Skip statistical analysis (summary stats, trend, anomalies) for that column
- Note "insufficient data" in the output

## Execution Environment

### Running the Analysis Script (Optional)

For complex statistical computations, you may invoke the Python analysis script:

```bash
python scripts/analyze.py \
  --data-csv /output/data.csv \
  --metadata /output/metadata.json \
  --output-json /output/analysis-results.json
```

The script outputs `analysis-results.json` with pre-computed statistics that can be embedded directly into the App.tsx component.

### Environment Requirements

- Python 3.9+
- Dependencies: `pandas`, `numpy`, `scipy` (see `scripts/requirements.txt`)
- **pip install flag:** Always use `pip install --break-system-packages` in the sandbox container. Plain `pip install` will fail on system-managed Python environments. Example: `pip install --break-system-packages pandas numpy scipy`

## References

- See `references/recharts-api.md` for Recharts component API, required props, data shapes, and code examples for LineChart, BarChart, AreaChart, PieChart, and ResponsiveContainer
- See `references/data-format-contract.md` for the complete input data contract between data engineering and data analysis skills, including column naming, metadata structure, and type classification
- See `references/sandpack-integration.md` for Sandpack environment configuration, allowed imports, file mapping, and rendering constraints
- See `templates/app-template.tsx` for a concrete example of the expected App.tsx output structure with all required dashboard sections
- See `scripts/analyze.py` for the Python statistical analysis implementation (summary stats, trends, anomalies, peak periods, uptime, energy costs)
- See `scripts/requirements.txt` for Python dependencies
