---
name: iot-data-engineering
description: >
  Transform raw IoT device telemetry from the myDevices platform into clean,
  analytics-ready time-series tables. Given a device_id and time range, fetches
  device metadata and readings, maps raw channel numbers to human-readable
  column names, and outputs a structured DataFrame with column descriptions.
  Use when the user wants to extract, clean, or prepare IoT sensor data for
  analysis, dashboards, or downstream analytics agents.
allowed-tools: ["Bash", "TextEditor", "Skill"]
---

# IoT Data Engineering Skill

## When to Use

- User provides a device_id and wants sensor data as a clean table
- User wants to prepare data for analytics, dashboards, or ML pipelines
- User asks about energy consumption, power, current, or operational metrics for a device
- User wants to understand what data a device produces

## Inputs

- `device_id` (cayenne_id) — UUID of the device (provided by the platform in Session State)
- `start_time` / `end_time` — time range (epoch ms or ISO 8601)
- Optional: specific channels or metrics of interest

### Time Range Resolution

The platform does NOT provide start/end times — you must extract them from the user's message:
- "last 2 weeks" → end=now, start=now minus 14 days
- "last 3 months" → end=now, start=now minus 90 days
- "from January to March" → convert to epoch ms
- **Default: last 30 days** if the user does not mention any time range
- Always convert to epoch milliseconds for the API call

## Steps

1. **Fetch device details** → get `device_type_id` and device config from properties
2. **Fetch device type** → get channel definitions (the data dictionary)
3. **Select analytics channels** → match by name pattern (see references/channel-patterns.md)
4. **Fetch readings** → raw time-series for the time range
5. **Transform** → map channels to descriptive columns, convert timestamps, handle status/time channels
6. **Output** → clean table + column metadata (see templates/output-metadata.json)

## Outputs

- `data.csv` or displayed table — timestamp + descriptive metric columns
- `metadata.json` — column descriptions, units, device info (from templates/output-metadata.json)

## Key Rules

- **Never use raw channel numbers as column names** — always resolve to descriptive names
- **Sort rows oldest-first** — API returns newest-first
- **Use device timezone** for timestamp conversion (from `codec.timezone` property)
- **Zero current/power = device OFF** — this is valid data, not missing data
- **Use `value_text` for time-duration channels** (506, 507) — not the numeric `v`
- **Map status channels to labels** (1→"Normal", 0→"Failure")
- **Handle missing channels** with null — not all readings have all channels

## Execution Environment

This skill runs in a **sandbox container**. You must **generate a custom Python script** based on the device's actual channels (discovered in Steps 1-3), write it to the workspace using write_file, then execute it.

**IMPORTANT:** `scripts/pipeline.py` in this skill directory is a REFERENCE IMPLEMENTATION only. Do NOT execute it directly — it is not mounted in the sandbox. Instead:
1. Read `scripts/pipeline.py` to understand the pattern
2. Generate a device-specific script based on the actual channels discovered
3. Write your generated script to the workspace using write_file (e.g. `output/pipeline.py` — relative path)
4. Execute it in the sandbox: `python3 output/pipeline.py --device-id ... --start ... --end ... --output-dir output`

**PATH RULES:**
- Always use **relative paths** (e.g. `output/pipeline.py`, NOT `/output/pipeline.py` or `/workspace/output/pipeline.py`)
- Create the output directory first: `mkdir -p output`
- The sandbox working directory is already set to your workspace — do NOT use `cd /workspace` or any absolute path prefix
- To write the generated script, use `write_file` with `path: "output/pipeline.py"`
- To run it, use `exec` with command: `python3 output/pipeline.py ...` (no cd, no absolute paths)

### Environment Variables (available in sandbox)

| Variable | Required | Description |
|----------|----------|-------------|
| `MYDEVICES_TOKEN` | Yes | JWT bearer token for myDevices API authentication |
| `MYDEVICES_BASE_URL` | No | API base URL (defaults to `https://api.mydevices.com`) |

### CLI Arguments (for your generated script)

```bash
mkdir -p output && python3 output/pipeline.py \
  --device-id d60c5cc0-5931-11f1-94d3-297a7f671e3c \
  --start 1781262279736 \
  --end 1781280640022 \
  --output-dir output
```

| Argument | Required | Description |
|----------|----------|-------------|
| `--device-id` | Yes | Device cayenne_id (UUID) |
| `--start` | Yes | Start time (epoch milliseconds) |
| `--end` | Yes | End time (epoch milliseconds) |
| `--output-dir` | No | Directory to write output files (defaults to current dir) |

### Output Files (sandbox mode)

When run in sandbox, the script writes:
- `{output_dir}/data.csv` — the clean time-series table
- `{output_dir}/metadata.json` — column descriptions and device info

### Container Requirements

- Python 3.9+
- Dependencies: `pandas`, `pytz`, `requests`
- **pip install flag:** Always use `pip install --break-system-packages` in the sandbox container. Plain `pip install` will fail on system-managed Python environments. Example: `pip install --break-system-packages pandas pytz requests`

## References

- See `references/channel-patterns.md` for the channel selection algorithm
- See `references/api-schema.md` for API endpoint details and response shapes
- See `references/sample-device-type.json` for a real device type response
- See `references/sample-readings.json` for a real readings response
- See `scripts/pipeline.py` for a complete Python reference implementation (runnable as CLI)
- See `templates/output-metadata.json` for the expected metadata output shape
