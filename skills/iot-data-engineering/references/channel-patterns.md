# Channel Selection Patterns

## Strategy

Select channels by **name pattern** (case-insensitive substring match on the channel `name` field from device type metadata). Never hardcode channel numbers — they vary across device types.

## Priority Patterns

Order matters: first match wins for ambiguous names (e.g., "Current" vs "Min Current").

### High Priority — Always Include

| Pattern (lowercase substring) | Output Column Name | Why |
|-------------------------------|-------------------|-----|
| `energy (total)` | `energy_total_kwh` | Cumulative meter reading |
| `energy (last hour)` | `energy_last_hour_kwh` | Rolling hourly consumption |
| `energy (last 24 hour)` | `energy_last_24h_kwh` | Rolling daily consumption |
| `power` | `power_kw` | Instantaneous load |
| `min current` | `min_current_a` | Interval minimum |
| `max current` | `max_current_a` | Interval peak |
| `current` | `current_a` | Average load current |

### Medium Priority — Include for Operational Context

| Pattern | Output Column Name | Why |
|---------|-------------------|-----|
| `capacitor voltage` | `capacitor_voltage_v` | Device health indicator |
| `internal temperature` | `internal_temperature` | Overheating detection |
| `total time machine running` | `machine_running_time` | Utilization |
| `total time machine down` | `machine_downtime` | Maintenance needs |
| `device status` | `device_status` | Operational state enum |

### Low Priority — Exclude

| Pattern | Why Excluded |
|---------|-------------|
| `rssi` | Network diagnostic, not operational |
| `multipler` | Configuration value, not a reading |
| `kilo ampere hour` | Redundant with energy channels when voltage is constant |

## 3-Phase Device Patterns

If channel names contain phase indicators, include all phases:

| Pattern | Output Column Name |
|---------|-------------------|
| `current phase a` | `current_phase_a` |
| `current phase b` | `current_phase_b` |
| `current phase c` | `current_phase_c` |
| `current l1` | `current_l1_a` |
| `current l2` | `current_l2_a` |
| `current l3` | `current_l3_a` |
| `voltage phase a` | `voltage_phase_a_v` |
| `voltage phase b` | `voltage_phase_b_v` |
| `voltage phase c` | `voltage_phase_c_v` |
| `power phase a` | `power_phase_a_kw` |
| `power phase b` | `power_phase_b_kw` |
| `power phase c` | `power_phase_c_kw` |

## Device Configuration Properties

These affect how readings should be interpreted:

| Property Key | Meaning | Impact |
|-------------|---------|--------|
| `codec.voltage` | Supply voltage (e.g., 120V) | Power = V × I × PF |
| `codec.power_factor` | Power factor (0–1) | Real vs apparent power |
| `child.127.unit` | Power unit ("kw" or "w") | Unit of power channel value |
| `codec.wires` | CT multiplier | Actual current = reading × multiplier |
| `codec.timezone` | Device timezone | Timestamp conversion |
| `codec.interval` | Reading interval (minutes) | Expected data frequency |
| `codec.reset` | Daily reset hour (0–24) | When rolling 24h metrics reset |
| `codec.threshold` | Current threshold | Below this → current reads 0 |
