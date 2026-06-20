# Data Format Contract

This document defines the contract between the **Data Engineering** skill output and the **Data Analysis** skill input. The data analysis skill consumes exactly two files produced by the data engineering pipeline.

## Input Files

| File | Format | Purpose |
|------|--------|---------|
| `data.csv` | CSV with header row | Time-series IoT telemetry readings |
| `metadata.json` | JSON object | Column definitions, device info, and context |

Both files are located in the same output directory (the `--output-dir` parameter used by the data engineering pipeline).

---

## data.csv Format

### General Structure

- First row is a header containing column names
- Each subsequent row represents one device reading at a point in time
- Rows are ordered chronologically (oldest first)
- The first column is always `timestamp`

### Column Naming Convention

Column names are derived from the channel selection patterns defined in `channel-patterns.md`. The data engineering pipeline maps raw API channel names to standardized snake_case output column names using case-insensitive substring matching on the channel `name` field.

**Naming rules:**
- All lowercase
- Words separated by underscores
- Physical unit appended as suffix (e.g., `_kwh`, `_kw`, `_a`, `_v`)
- Duration and enum columns have no unit suffix

### Available Columns

#### Always Present

| Column Name | Type | Example Value | Description |
|-------------|------|---------------|-------------|
| `timestamp` | ISO 8601 string | `2026-06-12T09:30:00-04:00` | Reading time in device-local timezone |

#### High Priority (Energy & Power)

| Column Name | Type | Unit | Source Pattern |
|-------------|------|------|----------------|
| `energy_total_kwh` | float | kWh | `energy (total)` |
| `energy_last_hour_kwh` | float | kWh | `energy (last hour)` |
| `energy_last_24h_kwh` | float | kWh | `energy (last 24 hour)` |
| `power_kw` | float | kW | `power` |
| `min_current_a` | float | A | `min current` |
| `max_current_a` | float | A | `max current` |
| `current_a` | float | A | `current` |

#### Medium Priority (Operational Context)

| Column Name | Type | Unit | Source Pattern |
|-------------|------|------|----------------|
| `capacitor_voltage_v` | float | V | `capacitor voltage` |
| `internal_temperature` | float | °F | `internal temperature` |
| `machine_running_time` | string (HH:MM:SS) | duration | `total time machine running` |
| `machine_downtime` | string (HH:MM:SS) | duration | `total time machine down` |
| `device_status` | string enum | enum | `device status` |

#### 3-Phase Device Columns (when applicable)

| Column Name | Type | Unit | Source Pattern |
|-------------|------|------|----------------|
| `current_phase_a` | float | A | `current phase a` |
| `current_phase_b` | float | A | `current phase b` |
| `current_phase_c` | float | A | `current phase c` |
| `voltage_phase_a_v` | float | V | `voltage phase a` |
| `voltage_phase_b_v` | float | V | `voltage phase b` |
| `voltage_phase_c_v` | float | V | `voltage phase c` |
| `power_phase_a_kw` | float | kW | `power phase a` |
| `power_phase_b_kw` | float | kW | `power phase b` |
| `power_phase_c_kw` | float | kW | `power phase c` |

**Not all columns are present for every device.** Availability depends on the device type's configured channels. Use `metadata.json` to determine which columns exist.

---

## metadata.json Structure

The metadata file is a JSON object with four top-level fields:

```json
{
  "columns": { ... },
  "device_info": { ... },
  "row_count": 120,
  "time_range": { "start": "...", "end": "..." }
}
```

### `columns` — Column Definitions

A map of column name → column definition. Each key matches a column header in `data.csv`.

```json
{
  "columns": {
    "timestamp": {
      "description": "Reading timestamp in device local timezone",
      "unit": "ISO 8601",
      "timezone": "America/New_York"
    },
    "power_kw": {
      "description": "Instantaneous power consumption",
      "unit": "kW",
      "source_channel": "127",
      "source_name": "Power"
    },
    "device_status": {
      "description": "Binary device operational status",
      "unit": "enum",
      "values": {"1": "Normal", "0": "Failure"},
      "source_channel": "511",
      "source_name": "Device Status"
    }
  }
}
```

**Column definition fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Human-readable description of the column |
| `unit` | Yes | Physical unit or type indicator |
| `timezone` | Only for timestamp | IANA timezone string |
| `source_channel` | For sensor columns | Raw API channel number |
| `source_name` | For sensor columns | Original channel name from device type |
| `values` | Only for enum columns | Map of raw value → human-readable label |

### `device_info` — Device Context

Contains device identification and configuration properties that affect data interpretation.

```json
{
  "device_info": {
    "device_id": 4205892,
    "device_name": "Air conditioning unit",
    "device_type": "Vutility HotDrop 5.0",
    "sensor_type": "Electric Meter",
    "timezone": "America/New_York",
    "voltage_setting": 120,
    "power_factor": 1,
    "multiplier": 1,
    "reading_interval_minutes": 15
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | integer | Yes | Unique device identifier |
| `device_name` | string | Yes | User-assigned device label |
| `device_type` | string | Yes | Hardware model name (e.g., "Vutility HotDrop 5.0") |
| `sensor_type` | string | Yes | Sensor category (e.g., "Electric Meter") |
| `timezone` | string | Yes | IANA timezone for timestamp interpretation |
| `voltage_setting` | number | Yes | Supply voltage in volts (for Power = V × I × PF) |
| `power_factor` | number | Yes | Power factor 0–1 (real vs apparent power) |
| `multiplier` | number | Yes | CT wire multiplier (actual current = reading × multiplier) |
| `reading_interval_minutes` | number | Yes | Expected interval between readings |

### `row_count` — Total Readings

Integer count of data rows in `data.csv` (excluding header).

### `time_range` — Data Bounds

```json
{
  "time_range": {
    "start": "2026-06-12T09:30:00-04:00",
    "end": "2026-06-12T14:30:00-04:00"
  }
}
```

Both values are ISO 8601 timestamps in the device-local timezone.

---

## Column Type Classification

Every column in the output belongs to one of three type categories. The `unit` field in `metadata.json` determines the classification:

### Numeric Columns

Columns with continuous float values suitable for statistical analysis (mean, median, min, max, std, trend, anomaly detection).

| Unit Value | Physical Meaning | Example Columns |
|------------|-----------------|-----------------|
| `kWh` | Energy (kilowatt-hours) | `energy_total_kwh`, `energy_last_hour_kwh`, `energy_last_24h_kwh` |
| `kW` | Power (kilowatts) | `power_kw`, `power_phase_a_kw` |
| `A` | Current (amperes) | `current_a`, `min_current_a`, `max_current_a` |
| `V` | Voltage (volts) | `capacitor_voltage_v`, `voltage_phase_a_v` |
| `°F` | Temperature (Fahrenheit) | `internal_temperature` |

**Analysis operations for numeric columns:** summary statistics, linear regression trend, z-score anomaly detection, hourly peak periods.

### Enum Columns

Columns with a fixed set of discrete string values. The `values` field in the column definition maps raw values to labels.

| Unit Value | Example Column | Possible Values |
|------------|---------------|-----------------|
| `enum` | `device_status` | `"Normal"`, `"Failure"` |

**Analysis operations for enum columns:** frequency counts, uptime percentage calculation.

### Duration Columns

Columns representing time durations as `HH:MM:SS` strings.

| Unit Value | Example Columns |
|------------|-----------------|
| `duration` | `machine_running_time`, `machine_downtime` |

**Analysis operations for duration columns:** convert to numeric hours for trending, calculate utilization ratios (running / (running + downtime)).

### Timestamp Column

The `timestamp` column (unit: `ISO 8601`) is the independent variable used for time-series ordering and grouping. It is not analyzed statistically itself.

---

## Determining Available Columns for a Device

Not all devices produce all columns. The set of available columns depends on the device type's channel configuration. To determine which columns are present:

1. **Read `metadata.json`** — the `columns` object contains only the columns that exist in the accompanying `data.csv`
2. **Iterate the keys** of `metadata.json.columns` — each key is a column header in the CSV
3. **Check the `unit` field** to classify each column by type (numeric, enum, duration, timestamp)
4. **Adapt analysis accordingly** — skip metrics that require missing columns:
   - No `device_status` column → skip uptime calculation
   - No energy columns → skip energy cost projections
   - No `machine_running_time`/`machine_downtime` → skip utilization analysis
   - Fewer than 3 data points in a column → skip statistical analysis for that column

### Example: Minimal Device

A simple current monitor may only produce:
```json
{
  "columns": {
    "timestamp": { "unit": "ISO 8601", ... },
    "current_a": { "unit": "A", ... }
  }
}
```

In this case, only current-based metrics are generated (summary stats, trend, anomalies for current). Energy, power, uptime, and utilization sections are omitted from the dashboard.

### Example: Full Energy Monitor

A Vutility HotDrop device typically produces all high-priority and medium-priority columns:
```json
{
  "columns": {
    "timestamp": { "unit": "ISO 8601", ... },
    "power_kw": { "unit": "kW", ... },
    "energy_total_kwh": { "unit": "kWh", ... },
    "energy_last_hour_kwh": { "unit": "kWh", ... },
    "energy_last_24h_kwh": { "unit": "kWh", ... },
    "current_a": { "unit": "A", ... },
    "min_current_a": { "unit": "A", ... },
    "max_current_a": { "unit": "A", ... },
    "capacitor_voltage_v": { "unit": "V", ... },
    "internal_temperature": { "unit": "°F", ... },
    "machine_running_time": { "unit": "duration", ... },
    "machine_downtime": { "unit": "duration", ... },
    "device_status": { "unit": "enum", ... }
  }
}
```

All dashboard sections and metrics are available for this device.

---

## Unit Mapping Reference

Quick reference for converting unit strings to display labels and analysis treatment:

| `unit` value in metadata | Display Label | Type Category | Statistical Analysis |
|--------------------------|---------------|---------------|---------------------|
| `ISO 8601` | — | timestamp | Independent variable (x-axis) |
| `kWh` | kilowatt-hours | numeric | Full stats + cost projection |
| `kW` | kilowatts | numeric | Full stats + peak detection |
| `A` | amperes | numeric | Full stats |
| `V` | volts | numeric | Full stats + deviation alerts |
| `°F` | degrees Fahrenheit | numeric | Full stats + overheating alerts |
| `duration` | HH:MM:SS | duration | Convert to hours, then stats |
| `enum` | — | enum | Frequency counts, uptime % |
