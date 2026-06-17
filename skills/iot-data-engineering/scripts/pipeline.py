"""
IoT Data Engineering Pipeline — Reference Implementation

Complete pipeline: device_id + time range → analytics-ready DataFrame + metadata.
Adapt for your runtime (MCP tool calls, direct HTTP, etc.)
"""

import pandas as pd
import json
from datetime import datetime, timezone
import pytz
import requests
import os


# ============================================================
# AUTHENTICATED CLIENT
# ============================================================

BASE_URL = os.environ.get("MYDEVICES_BASE_URL", "https://api.mydevices.com")


def create_client(bearer_token=None):
    """
    Create an authenticated requests.Session for the myDevices API.

    Args:
        bearer_token: JWT bearer token. If not provided, reads from
                      MYDEVICES_TOKEN environment variable.

    Returns:
        requests.Session with Authorization header and base_url attribute set.
    """
    token = bearer_token or os.environ.get("MYDEVICES_TOKEN")
    if not token:
        raise ValueError(
            "No bearer token provided. Pass bearer_token argument or set MYDEVICES_TOKEN env var."
        )

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    # Monkey-patch a base_url-aware get method for convenience
    _original_get = session.get

    def get_with_base(path, **kwargs):
        url = f"{BASE_URL}{path}" if path.startswith("/") else path
        return _original_get(url, **kwargs)

    session.get = get_with_base
    return session


# ============================================================
# STEP 1: Fetch device details
# ============================================================

def get_device_details(client, device_id):
    """
    Fetch device details using cayenne_id.
    API: GET /v1.0/admin/things/{device_id}
    """
    response = client.get(f"/v1.0/admin/things/{device_id}")
    device = response.json()
    properties = json.loads(device.get("properties", "{}"))

    return {
        "device_id": device["id"],
        "cayenne_id": device.get("cayenne_id"),
        "device_name": device.get("thing_name", "Unknown Device"),
        "sensor_type": device.get("sensor_type", ""),
        "device_type_id": device.get("device_type_id"),
        "timezone": properties.get("codec.timezone", "UTC"),
        "voltage": properties.get("codec.voltage", 120),
        "power_factor": properties.get("codec.power_factor", 1),
        "multiplier": properties.get("codec.wires", 1),
        "power_unit": properties.get("child.127.unit", "kw"),
        "interval_minutes": properties.get("codec.interval", 15),
        "threshold": properties.get("codec.threshold", 1),
        "reset_hour": properties.get("codec.reset", 24),
    }


# ============================================================
# STEP 2: Fetch device type → channel definitions
# ============================================================

def get_device_type_channels(client, device_type_id):
    """
    Fetch device type. channels[] is the data dictionary.
    API: GET /v1.0/things/types/{device_type_id}
    """
    response = client.get(f"/v1.0/things/types/{device_type_id}")
    device_type = response.json()

    channel_map = {}
    for ch in device_type.get("channels", []):
        channel_num = ch["channel"]
        units = ch.get("data", {}).get("units", [])
        default_unit = next((u for u in units if u.get("default")), units[0] if units else {})
        statuses = ch.get("data", {}).get("statuses", [])

        channel_map[channel_num] = {
            "name": ch["name"],
            "unit_display": default_unit.get("display", "").strip(),
            "unit_payload": default_unit.get("payload", ""),
            "status_map": {s["value"]: s["label"] for s in statuses} if statuses else None,
            "template": ch.get("data", {}).get("template", "value"),
        }

    return {
        "device_type_name": device_type.get("name", "Unknown"),
        "manufacturer": device_type.get("manufacturer", ""),
        "channel_map": channel_map,
    }


# ============================================================
# STEP 3: Select analytics-relevant channels
# ============================================================

def select_analytics_channels(channel_map):
    """
    Match channels by name pattern. First match wins.
    """
    PATTERNS = [
        ("energy (total)", "energy_total_kwh"),
        ("energy (last hour)", "energy_last_hour_kwh"),
        ("energy (last 24 hour)", "energy_last_24h_kwh"),
        ("power phase a", "power_phase_a_kw"),
        ("power phase b", "power_phase_b_kw"),
        ("power phase c", "power_phase_c_kw"),
        ("power", "power_kw"),
        ("min current", "min_current_a"),
        ("max current", "max_current_a"),
        ("current phase a", "current_phase_a"),
        ("current phase b", "current_phase_b"),
        ("current phase c", "current_phase_c"),
        ("current l1", "current_l1_a"),
        ("current l2", "current_l2_a"),
        ("current l3", "current_l3_a"),
        ("current", "current_a"),
        ("voltage phase a", "voltage_phase_a_v"),
        ("voltage phase b", "voltage_phase_b_v"),
        ("voltage phase c", "voltage_phase_c_v"),
        ("capacitor voltage", "capacitor_voltage_v"),
        ("voltage", "voltage_v"),
        ("internal temperature", "internal_temperature"),
        ("temperature", "temperature"),
        ("total time machine running", "machine_running_time"),
        ("total time machine down", "machine_downtime"),
        ("device status", "device_status"),
    ]

    selected = {}
    used_columns = set()

    for channel_num, info in channel_map.items():
        name_lower = info["name"].lower().strip()
        for pattern, col_name in PATTERNS:
            if pattern in name_lower and col_name not in used_columns:
                selected[channel_num] = col_name
                used_columns.add(col_name)
                break

    return selected


# ============================================================
# STEP 4: Fetch and transform readings
# ============================================================

def get_readings(client, device_id, start_ms, end_ms):
    """
    API: GET /v1.0/admin/things/{device_id}/readings?start={start_ms}&end={end_ms}
    """
    response = client.get(
        f"/v1.0/admin/things/{device_id}/readings",
        params={"start": start_ms, "end": end_ms}
    )
    return response.json().get("readings", [])


def transform_readings_to_dataframe(readings, selected_channels, channel_map, device_info):
    """
    Raw readings → clean DataFrame with descriptive columns.
    """
    tz = pytz.timezone(device_info["timezone"])
    rows = []

    for reading in readings:
        dt = datetime.fromtimestamp(reading["ts"] / 1000, tz=timezone.utc).astimezone(tz)
        row = {"timestamp": dt.isoformat()}
        sensor_lookup = {s["channel"]: s for s in reading.get("sensors", [])}

        for channel_num, col_name in selected_channels.items():
            sensor = sensor_lookup.get(channel_num)
            if sensor is None:
                row[col_name] = None
                continue

            ch_info = channel_map.get(channel_num, {})

            if ch_info.get("status_map"):
                raw_val = str(int(sensor.get("v", 0)))
                row[col_name] = ch_info["status_map"].get(raw_val, f"Unknown({raw_val})")
            elif "value_text" in sensor:
                row[col_name] = sensor["value_text"]
            else:
                row[col_name] = sensor.get("v")

        rows.append(row)

    df = pd.DataFrame(rows)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


# ============================================================
# STEP 5: Build column metadata
# ============================================================

def build_column_metadata(selected_channels, channel_map, device_info):
    """Column descriptions for downstream consumers."""
    metadata = {
        "columns": {
            "timestamp": {
                "description": "Reading timestamp in device local timezone",
                "unit": "ISO 8601",
                "timezone": device_info["timezone"],
            }
        },
        "device_info": {
            "device_id": device_info["device_id"],
            "device_name": device_info["device_name"],
            "sensor_type": device_info["sensor_type"],
            "timezone": device_info["timezone"],
            "voltage_setting": device_info["voltage"],
            "power_factor": device_info["power_factor"],
            "multiplier": device_info["multiplier"],
            "reading_interval_minutes": device_info["interval_minutes"],
        }
    }

    for channel_num, col_name in selected_channels.items():
        ch_info = channel_map.get(channel_num, {})
        col_meta = {
            "description": ch_info.get("name", col_name),
            "unit": ch_info.get("unit_display", ""),
            "source_channel": channel_num,
            "source_name": ch_info.get("name", ""),
        }
        if ch_info.get("status_map"):
            col_meta["values"] = ch_info["status_map"]
            col_meta["unit"] = "enum"
        metadata["columns"][col_name] = col_meta

    return metadata


# ============================================================
# FULL PIPELINE
# ============================================================

def build_analytics_table(client, device_id, start_ms, end_ms):
    """
    Complete: device_id + time range → (DataFrame, metadata_dict)
    """
    device_info = get_device_details(client, device_id)
    type_info = get_device_type_channels(client, device_info["device_type_id"])
    channel_map = type_info["channel_map"]
    device_info["device_type_name"] = type_info["device_type_name"]

    selected_channels = select_analytics_channels(channel_map)
    readings = get_readings(client, device_id, start_ms, end_ms)
    df = transform_readings_to_dataframe(readings, selected_channels, channel_map, device_info)

    metadata = build_column_metadata(selected_channels, channel_map, device_info)
    metadata["device_info"]["device_type"] = type_info["device_type_name"]
    metadata["row_count"] = len(df)
    if len(df) > 0:
        metadata["time_range"] = {"start": df["timestamp"].iloc[0], "end": df["timestamp"].iloc[-1]}

    return df, metadata


# ============================================================
# UTILITIES
# ============================================================

def detect_operational_state(df):
    """Add ON/OFF column based on current, power, or status."""
    if "current_a" in df.columns:
        df["operational_state"] = df["current_a"].apply(lambda x: "ON" if x and x > 0 else "OFF")
    elif "power_kw" in df.columns:
        df["operational_state"] = df["power_kw"].apply(lambda x: "ON" if x and x > 0 else "OFF")
    elif "device_status" in df.columns:
        df["operational_state"] = df["device_status"].apply(lambda x: "ON" if x == "Normal" else "OFF")
    return df


def calculate_energy_deltas(df):
    """Add incremental energy consumption between consecutive readings."""
    if "energy_total_kwh" not in df.columns:
        return df
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["energy_delta_kwh"] = df["energy_total_kwh"].diff()
    df.loc[0, "energy_delta_kwh"] = None
    df.loc[df["energy_delta_kwh"] < 0, "energy_delta_kwh"] = None  # meter reset
    return df


def summarize_table(df, metadata):
    """Human-readable summary for agent responses."""
    lines = [
        f"Device: {metadata['device_info']['device_name']} ({metadata['device_info'].get('device_type', '')})",
        f"Sensor Type: {metadata['device_info']['sensor_type']}",
        f"Timezone: {metadata['device_info']['timezone']}",
        f"Rows: {metadata['row_count']}",
    ]
    if "time_range" in metadata:
        lines.append(f"Time Range: {metadata['time_range']['start']} → {metadata['time_range']['end']}")
    lines.append("")
    lines.append("Columns:")
    for col_name, col_info in metadata["columns"].items():
        unit_str = f" ({col_info['unit']})" if col_info.get("unit") else ""
        lines.append(f"  • {col_name}: {col_info['description']}{unit_str}")
    return "\n".join(lines)


# ============================================================
# EXAMPLE USAGE
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="IoT Data Engineering Pipeline — transform device telemetry to analytics-ready tables."
    )
    parser.add_argument("--device-id", required=True, help="Device cayenne_id (UUID)")
    parser.add_argument("--start", required=True, type=int, help="Start time (epoch milliseconds)")
    parser.add_argument("--end", required=True, type=int, help="End time (epoch milliseconds)")
    parser.add_argument("--output-dir", default=".", help="Directory to write output files (default: current dir)")
    parser.add_argument("--token", default=None, help="Bearer token (or set MYDEVICES_TOKEN env var)")

    args = parser.parse_args()

    client = create_client(bearer_token=args.token)
    df, metadata = build_analytics_table(client, args.device_id, args.start, args.end)

    # Add operational state and energy deltas
    df = detect_operational_state(df)
    df = calculate_energy_deltas(df)

    # Write outputs
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)

    csv_path = os.path.join(output_dir, "data.csv")
    meta_path = os.path.join(output_dir, "metadata.json")

    df.to_csv(csv_path, index=False)
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    # Print summary to stdout
    print(summarize_table(df, metadata))
    print(f"\nOutputs written to: {csv_path}, {meta_path}")
