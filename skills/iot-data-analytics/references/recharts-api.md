# Recharts Component API Reference

## Data Shape

All Recharts chart components accept data as an **array of objects** with named keys. Each object represents one data point.

```typescript
// Standard IoT time-series data shape
interface DataPoint {
  timestamp: string;       // ISO 8601 or formatted label
  power_kw: number;
  energy_total_kwh: number;
  current_a: number;
  [key: string]: string | number;
}

const data: DataPoint[] = [
  { timestamp: "09:00", power_kw: 1.44, energy_total_kwh: 52400.5, current_a: 12.0 },
  { timestamp: "09:15", power_kw: 1.52, energy_total_kwh: 52400.9, current_a: 12.7 },
  { timestamp: "09:30", power_kw: 1.38, energy_total_kwh: 52401.2, current_a: 11.5 },
];
```

## Import Patterns

```typescript
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
```

Import only the components you need. Each chart type requires its corresponding shape component (e.g., `LineChart` needs `Line`, `BarChart` needs `Bar`).

---

## ResponsiveContainer

Wraps any chart to make it responsive. **Required** — without it, charts render at 0×0.

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `width` | string \| number | Container width. Use `"100%"` for responsive. |
| `height` | number | Container height in pixels. |

### Usage

```typescript
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

const data = [
  { timestamp: "09:00", power_kw: 1.44 },
  { timestamp: "09:15", power_kw: 1.52 },
  { timestamp: "09:30", power_kw: 1.38 },
  { timestamp: "09:45", power_kw: 1.61 },
];

function PowerChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="power_kw" stroke="#3b82f6" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## LineChart

Best for time-series trends — power over time, energy accumulation, current fluctuations.

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | object[] | Array of data point objects. |

### Line Sub-Component Props

| Prop | Type | Description |
|------|------|-------------|
| `dataKey` | string | Key in data objects to plot on Y-axis. **Required.** |
| `type` | string | Interpolation type: `"monotone"`, `"linear"`, `"step"`. |
| `stroke` | string | Line color (hex or CSS color). |
| `strokeWidth` | number | Line thickness in pixels. |
| `dot` | boolean | Show data point dots. Set `false` for dense data. |
| `name` | string | Display name in Tooltip and Legend. |

### Full Example — Power Trend Over Time

```typescript
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const powerReadings = [
  { timestamp: "2024-06-12T09:00", power_kw: 1.44, current_a: 12.0 },
  { timestamp: "2024-06-12T09:15", power_kw: 1.52, current_a: 12.7 },
  { timestamp: "2024-06-12T09:30", power_kw: 1.38, current_a: 11.5 },
  { timestamp: "2024-06-12T09:45", power_kw: 1.61, current_a: 13.4 },
  { timestamp: "2024-06-12T10:00", power_kw: 1.55, current_a: 12.9 },
  { timestamp: "2024-06-12T10:15", power_kw: 1.49, current_a: 12.4 },
];

function PowerTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={powerReadings} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(t) => t.split("T")[1]}
          label={{ value: "Time", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          labelFormatter={(t) => `Time: ${t}`}
          formatter={(value: number) => [`${value.toFixed(2)} kW`, "Power"]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="power_kw"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Power (kW)"
        />
        <Line
          type="monotone"
          dataKey="current_a"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="Current (A)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## BarChart

Best for distribution analysis — hourly averages, comparative metrics, peak periods.

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | object[] | Array of data point objects. |

### Bar Sub-Component Props

| Prop | Type | Description |
|------|------|-------------|
| `dataKey` | string | Key in data objects to plot as bar height. **Required.** |
| `fill` | string | Bar fill color. |
| `name` | string | Display name in Tooltip and Legend. |
| `radius` | [number, number, number, number] | Border radius [topLeft, topRight, bottomRight, bottomLeft]. |

### Full Example — Hourly Energy Distribution

```typescript
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const hourlyConsumption = [
  { hour: "00:00", energy_kwh: 0.8 },
  { hour: "03:00", energy_kwh: 0.6 },
  { hour: "06:00", energy_kwh: 1.1 },
  { hour: "09:00", energy_kwh: 2.4 },
  { hour: "12:00", energy_kwh: 2.8 },
  { hour: "15:00", energy_kwh: 2.6 },
  { hour: "18:00", energy_kwh: 1.9 },
  { hour: "21:00", energy_kwh: 1.2 },
];

function HourlyDistributionChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={hourlyConsumption} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          label={{ value: "Hour of Day", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          label={{ value: "Energy (kWh)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Energy"]} />
        <Legend />
        <Bar
          dataKey="energy_kwh"
          fill="#8b5cf6"
          name="Avg Energy (kWh)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## AreaChart

Best for cumulative metrics and filled trend visualization — energy accumulation, load profiles.

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | object[] | Array of data point objects. |

### Area Sub-Component Props

| Prop | Type | Description |
|------|------|-------------|
| `dataKey` | string | Key in data objects to plot. **Required.** |
| `type` | string | Interpolation type: `"monotone"`, `"linear"`, `"step"`. |
| `stroke` | string | Area border color. |
| `fill` | string | Area fill color. Use with `fillOpacity`. |
| `fillOpacity` | number | Opacity of fill (0–1). |
| `name` | string | Display name in Tooltip and Legend. |

### Full Example — Cumulative Energy Consumption

```typescript
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const cumulativeEnergy = [
  { timestamp: "06:00", energy_total_kwh: 52380.0 },
  { timestamp: "08:00", energy_total_kwh: 52383.2 },
  { timestamp: "10:00", energy_total_kwh: 52387.5 },
  { timestamp: "12:00", energy_total_kwh: 52392.8 },
  { timestamp: "14:00", energy_total_kwh: 52397.1 },
  { timestamp: "16:00", energy_total_kwh: 52401.4 },
  { timestamp: "18:00", energy_total_kwh: 52404.6 },
];

function CumulativeEnergyChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={cumulativeEnergy} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          label={{ value: "Time", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          domain={["dataMin - 5", "dataMax + 5"]}
          label={{ value: "Total Energy (kWh)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip formatter={(value: number) => [`${value.toFixed(1)} kWh`, "Total Energy"]} />
        <Legend />
        <Area
          type="monotone"
          dataKey="energy_total_kwh"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.3}
          name="Cumulative Energy (kWh)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

---

## PieChart

Best for proportional breakdowns — uptime vs downtime, status distribution, energy share by period.

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| (none on PieChart) | — | PieChart is a container; configuration lives on `Pie`. |

### Pie Sub-Component Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | object[] | Array of data objects for the pie. **Required.** |
| `dataKey` | string | Key for slice size value. **Required.** |
| `nameKey` | string | Key for slice label. |
| `cx` | string \| number | Center X. Use `"50%"` for centered. |
| `cy` | string \| number | Center Y. Use `"50%"` for centered. |
| `outerRadius` | number | Outer radius in pixels. |
| `innerRadius` | number | Inner radius (set > 0 for donut chart). |
| `label` | boolean \| function | Show labels on slices. |

### Cell Sub-Component

Use `Cell` to assign individual colors to each slice:

```typescript
<Pie data={data} dataKey="value">
  {data.map((_, index) => (
    <Cell key={index} fill={COLORS[index % COLORS.length]} />
  ))}
</Pie>
```

### Full Example — Device Status Distribution

```typescript
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const statusData = [
  { name: "Normal", value: 142, color: "#10b981" },
  { name: "Failure", value: 8, color: "#ef4444" },
  { name: "Idle", value: 22, color: "#f59e0b" },
];

const COLORS = ["#10b981", "#ef4444", "#f59e0b"];

function DeviceStatusPieChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={statusData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={60}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {statusData.map((entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} readings`, "Count"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

---

## Axis Configuration

### XAxis

| Prop | Type | Description |
|------|------|-------------|
| `dataKey` | string | Key to use for axis values. **Required for category axis.** |
| `type` | `"category"` \| `"number"` | Axis type. Default: `"category"`. |
| `tickFormatter` | (value) => string | Format tick labels. |
| `label` | object | Axis label: `{ value, position, offset }`. |
| `angle` | number | Rotate tick labels (degrees). |
| `interval` | number \| `"preserveStart"` | Tick interval control. |

### YAxis

| Prop | Type | Description |
|------|------|-------------|
| `domain` | [min, max] | Y-axis range. Use `["auto", "auto"]` or `["dataMin", "dataMax"]`. |
| `label` | object | Axis label: `{ value, angle, position }`. |
| `tickFormatter` | (value) => string | Format tick labels. |
| `unit` | string | Appended to tick values. |
| `width` | number | Axis width to prevent label clipping. |

### CartesianGrid

| Prop | Type | Description |
|------|------|-------------|
| `strokeDasharray` | string | Dash pattern. `"3 3"` for dashed lines. |
| `horizontal` | boolean | Show horizontal grid lines. |
| `vertical` | boolean | Show vertical grid lines. |

### Example — Formatted Axes for IoT Data

```typescript
<XAxis
  dataKey="timestamp"
  tickFormatter={(ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
  angle={-45}
  textAnchor="end"
  height={60}
  interval="preserveStartEnd"
/>
<YAxis
  domain={[0, "dataMax + 1"]}
  tickFormatter={(val: number) => `${val.toFixed(1)}`}
  label={{ value: "Current (A)", angle: -90, position: "insideLeft" }}
  width={80}
/>
<CartesianGrid strokeDasharray="3 3" />
```

---

## Tooltip

Displays on hover. Automatically reads data from the chart.

| Prop | Type | Description |
|------|------|-------------|
| `formatter` | (value, name) => [string, string] | Format displayed value and label. |
| `labelFormatter` | (label) => string | Format the tooltip header. |
| `contentStyle` | object | CSS styles for tooltip container. |

### Example

```typescript
<Tooltip
  labelFormatter={(ts) => `Reading at ${ts}`}
  formatter={(value: number, name: string) => [
    `${value.toFixed(2)} ${name.includes("kw") ? "kW" : name.includes("kwh") ? "kWh" : "A"}`,
    name.replace(/_/g, " "),
  ]}
  contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#f9fafb" }}
/>
```

---

## Legend

Displays a legend for all data series in the chart.

| Prop | Type | Description |
|------|------|-------------|
| `verticalAlign` | `"top"` \| `"middle"` \| `"bottom"` | Vertical position. |
| `align` | `"left"` \| `"center"` \| `"right"` | Horizontal alignment. |
| `wrapperStyle` | object | CSS styles for legend wrapper. |
| `iconType` | string | Icon shape: `"circle"`, `"square"`, `"line"`. |

### Example

```typescript
<Legend
  verticalAlign="top"
  align="right"
  wrapperStyle={{ paddingBottom: "10px" }}
  iconType="circle"
/>
```

---

## Common Patterns for IoT Dashboards

### Multi-Metric Line Chart

Plot multiple IoT metrics on a single chart with dual Y-axes:

```typescript
<LineChart data={readings}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="timestamp" tickFormatter={(t) => t.split("T")[1]?.slice(0, 5)} />
  <YAxis yAxisId="left" label={{ value: "kW", angle: -90, position: "insideLeft" }} />
  <YAxis yAxisId="right" orientation="right" label={{ value: "A", angle: 90, position: "insideRight" }} />
  <Tooltip />
  <Legend />
  <Line yAxisId="left" type="monotone" dataKey="power_kw" stroke="#3b82f6" name="Power (kW)" dot={false} />
  <Line yAxisId="right" type="monotone" dataKey="current_a" stroke="#10b981" name="Current (A)" dot={false} />
</LineChart>
```

### Downsampled Data for Large Datasets

When embedding more than 500 data points, downsample for chart performance:

```typescript
// Take every Nth point to keep chart data under 500 points
const downsampleFactor = Math.ceil(fullData.length / 500);
const chartData = fullData.filter((_, i) => i % downsampleFactor === 0);
```

### Color Palette for IoT Metrics

```typescript
const METRIC_COLORS = {
  power_kw: "#3b82f6",        // blue
  energy_total_kwh: "#f59e0b", // amber
  current_a: "#10b981",        // emerald
  voltage_v: "#8b5cf6",        // violet
  temperature: "#ef4444",      // red
  uptime: "#06b6d4",           // cyan
};
```
