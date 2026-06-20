"""
IoT Data Analysis Script

Performs statistical analysis on data.csv + metadata.json produced by the
Data Engineering skill, and writes results to an output JSON file.

Usage:
    python analyze.py --data-csv /path/to/data.csv \
                      --metadata /path/to/metadata.json \
                      --output-json /path/to/analysis-results.json
"""

import argparse
import json
import sys
from datetime import datetime

import numpy as np
import pandas as pd

# Attempt to import scipy for linear regression; fall back to numpy if unavailable.
try:
    from scipy import stats as scipy_stats

    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


# ============================================================
# STATISTICAL FUNCTIONS
# ============================================================


def compute_summary_stats(values):
    """
    Compute summary statistics for a numeric array.

    Args:
        values: array-like of numeric values (NaN values are excluded).

    Returns:
        dict with keys: mean, median, min, max, std, count
    """
    arr = np.asarray(values, dtype=float)
    arr = arr[~np.isnan(arr)]

    if len(arr) == 0:
        return {"mean": None, "median": None, "min": None, "max": None, "std": None, "count": 0}

    return {
        "mean": float(np.mean(arr)),
        "median": float(np.median(arr)),
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "std": float(np.std(arr, ddof=0)),
        "count": int(len(arr)),
    }


def detect_trend(timestamps, values):
    """
    Detect trend direction via linear regression of values against time.

    Args:
        timestamps: array-like of datetime strings (ISO 8601) or datetime objects.
        values: array-like of numeric values.

    Returns:
        dict with keys: slope, p_value, direction ("increasing", "decreasing", or "stable").
        If scipy is unavailable, p_value is set to None and direction uses slope sign only.
    """
    ts_arr = pd.to_datetime(timestamps)
    val_arr = np.asarray(values, dtype=float)

    # Remove NaN pairs
    mask = ~np.isnan(val_arr)
    ts_arr = ts_arr[mask]
    val_arr = val_arr[mask]

    if len(val_arr) < 3:
        return {"slope": None, "p_value": None, "direction": "stable"}

    # Convert timestamps to numeric (seconds since first timestamp)
    t0 = ts_arr.min()
    x = np.array([(t - t0).total_seconds() for t in ts_arr], dtype=float)

    if SCIPY_AVAILABLE:
        slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(x, val_arr)
        p_value = float(p_value)
    else:
        # Fallback: numpy polyfit (no p-value available)
        coeffs = np.polyfit(x, val_arr, 1)
        slope = coeffs[0]
        p_value = None

    slope = float(slope)

    if p_value is not None and p_value >= 0.05:
        direction = "stable"
    elif slope > 0:
        direction = "increasing"
    elif slope < 0:
        direction = "decreasing"
    else:
        direction = "stable"

    return {"slope": slope, "p_value": p_value, "direction": direction}


def detect_anomalies(values):
    """
    Detect anomalies as data points with |z-score| > 2.0.

    Args:
        values: array-like of numeric values.

    Returns:
        list of dicts with keys: index, value, z_score
        (index is the position in the original array, excluding NaN positions).
    """
    arr = np.asarray(values, dtype=float)

    # Build index map for non-NaN values
    non_nan_mask = ~np.isnan(arr)
    clean_indices = np.where(non_nan_mask)[0]
    clean_values = arr[non_nan_mask]

    if len(clean_values) < 3:
        return []

    mean = np.mean(clean_values)
    std = np.std(clean_values, ddof=0)

    if std == 0:
        return []

    anomalies = []
    for i, idx in enumerate(clean_indices):
        z = (clean_values[i] - mean) / std
        if abs(z) > 2.0:
            anomalies.append({
                "index": int(idx),
                "value": float(clean_values[i]),
                "z_score": float(z),
            })

    return anomalies


def find_peak_periods(timestamps, values, top_n=3):
    """
    Find the top-N hourly periods with the highest average value.

    Args:
        timestamps: array-like of datetime strings (ISO 8601) or datetime objects.
        values: array-like of numeric values.
        top_n: number of top periods to return (default 3).

    Returns:
        list of dicts with keys: hour_start (0-23), avg_value
        Sorted descending by avg_value.
    """
    ts_arr = pd.to_datetime(timestamps)
    val_arr = np.asarray(values, dtype=float)

    # Remove NaN pairs
    mask = ~np.isnan(val_arr)
    ts_arr = ts_arr[mask]
    val_arr = val_arr[mask]

    if len(val_arr) == 0:
        return []

    # Group by hour-of-day
    hours = np.array([t.hour for t in ts_arr])
    unique_hours = np.unique(hours)

    hourly_avgs = []
    for h in unique_hours:
        h_mask = hours == h
        avg = float(np.mean(val_arr[h_mask]))
        hourly_avgs.append({"hour_start": int(h), "avg_value": avg})

    # Sort descending by avg_value
    hourly_avgs.sort(key=lambda x: x["avg_value"], reverse=True)

    # Return top-N (or fewer if not enough distinct hours)
    return hourly_avgs[: min(top_n, len(hourly_avgs))]


def compute_uptime(statuses):
    """
    Compute uptime percentage from device status values.

    Args:
        statuses: array-like of status strings (e.g., "Normal", "Failure").

    Returns:
        float: percentage of entries that are "Normal" (0-100).
        Returns None if statuses is empty.
    """
    status_list = list(statuses)
    if len(status_list) == 0:
        return None

    normal_count = sum(1 for s in status_list if s == "Normal")
    return (normal_count / len(status_list)) * 100.0


def compute_energy_cost(total_kwh, rate_usd=0.12):
    """
    Compute energy cost projection.

    Args:
        total_kwh: total energy consumption in kWh.
        rate_usd: cost rate in USD per kWh (default 0.12).

    Returns:
        dict with keys: total_kwh, rate_usd, total_cost_usd
    """
    total_cost = total_kwh * rate_usd
    return {
        "total_kwh": float(total_kwh),
        "rate_usd": float(rate_usd),
        "total_cost_usd": float(total_cost),
    }


# ============================================================
# ANALYSIS PIPELINE
# ============================================================


def classify_columns(metadata):
    """Classify columns from metadata into numeric, enum, duration, and timestamp."""
    numeric_units = {"kWh", "kW", "A", "V", "°F"}
    columns = metadata.get("columns", {})

    numeric_cols = []
    enum_cols = []
    duration_cols = []

    for col_name, col_info in columns.items():
        unit = col_info.get("unit", "")
        if unit == "ISO 8601":
            continue  # timestamp column
        elif unit in numeric_units:
            numeric_cols.append(col_name)
        elif unit == "enum":
            enum_cols.append(col_name)
        elif unit == "duration":
            duration_cols.append(col_name)

    return numeric_cols, enum_cols, duration_cols


def run_analysis(df, metadata):
    """
    Run the full analysis pipeline on the dataframe.

    Returns:
        dict: analysis results matching the output schema.
    """
    numeric_cols, enum_cols, duration_cols = classify_columns(metadata)

    results = {
        "summary_stats": {},
        "trends": {},
        "anomalies": {},
        "peak_periods": {},
        "uptime_percent": None,
        "energy_metrics": None,
    }

    if df.empty:
        return results

    # --- Summary Statistics ---
    for col in numeric_cols:
        if col not in df.columns:
            continue
        values = df[col].dropna().values
        if len(values) < 3:
            continue
        results["summary_stats"][col] = compute_summary_stats(values)

    # --- Trends ---
    if "timestamp" in df.columns:
        for col in numeric_cols:
            if col not in df.columns:
                continue
            values = df[col].values
            non_nan_count = np.sum(~np.isnan(np.asarray(values, dtype=float)))
            if non_nan_count < 3:
                continue
            trend = detect_trend(df["timestamp"].values, values)
            results["trends"][col] = trend

    # --- Anomalies ---
    for col in numeric_cols:
        if col not in df.columns:
            continue
        values = df[col].values
        anomalies = detect_anomalies(values)
        if anomalies:
            # Enrich with timestamp if available
            if "timestamp" in df.columns:
                for a in anomalies:
                    idx = a["index"]
                    if idx < len(df):
                        a["timestamp"] = str(df["timestamp"].iloc[idx])
            results["anomalies"][col] = anomalies

    # --- Peak Periods ---
    if "timestamp" in df.columns:
        for col in numeric_cols:
            if col not in df.columns:
                continue
            values = df[col].values
            non_nan_count = np.sum(~np.isnan(np.asarray(values, dtype=float)))
            if non_nan_count == 0:
                continue
            peaks = find_peak_periods(df["timestamp"].values, values, top_n=3)
            if peaks:
                results["peak_periods"][col] = peaks

    # --- Uptime ---
    if "device_status" in df.columns:
        statuses = df["device_status"].dropna().tolist()
        if statuses:
            results["uptime_percent"] = compute_uptime(statuses)

    # --- Energy Metrics ---
    energy_cols = [c for c in ["energy_total_kwh", "energy_last_hour_kwh", "energy_last_24h_kwh"] if c in df.columns]
    if energy_cols and "timestamp" in df.columns:
        # Use energy_total_kwh for total consumption if available
        if "energy_total_kwh" in df.columns:
            energy_values = df["energy_total_kwh"].dropna()
            if len(energy_values) >= 2:
                total_kwh = float(energy_values.iloc[-1] - energy_values.iloc[0])
                # Calculate time span in hours
                ts_series = pd.to_datetime(df["timestamp"])
                time_span_hours = (ts_series.max() - ts_series.min()).total_seconds() / 3600.0

                rate_kwh_per_hour = total_kwh / time_span_hours if time_span_hours > 0 else 0.0
                cost = compute_energy_cost(total_kwh)

                results["energy_metrics"] = {
                    "total_consumption_kwh": total_kwh,
                    "rate_kwh_per_hour": float(rate_kwh_per_hour),
                    "cost_rate_usd": cost["rate_usd"],
                    "projected_cost_usd": cost["total_cost_usd"],
                }
        elif "energy_last_hour_kwh" in df.columns:
            # Fallback: sum hourly energy readings
            hourly_values = df["energy_last_hour_kwh"].dropna()
            if len(hourly_values) > 0:
                total_kwh = float(hourly_values.sum())
                ts_series = pd.to_datetime(df["timestamp"])
                time_span_hours = (ts_series.max() - ts_series.min()).total_seconds() / 3600.0
                rate_kwh_per_hour = total_kwh / time_span_hours if time_span_hours > 0 else 0.0
                cost = compute_energy_cost(total_kwh)

                results["energy_metrics"] = {
                    "total_consumption_kwh": total_kwh,
                    "rate_kwh_per_hour": float(rate_kwh_per_hour),
                    "cost_rate_usd": cost["rate_usd"],
                    "projected_cost_usd": cost["total_cost_usd"],
                }

    return results


# ============================================================
# CLI ENTRY POINT
# ============================================================


def main():
    parser = argparse.ArgumentParser(
        description="IoT Data Analysis — compute statistics on data engineering output."
    )
    parser.add_argument(
        "--data-csv", required=True, help="Path to data.csv from data engineering pipeline"
    )
    parser.add_argument(
        "--metadata", required=True, help="Path to metadata.json from data engineering pipeline"
    )
    parser.add_argument(
        "--output-json", required=True, help="Path to write analysis results JSON"
    )

    args = parser.parse_args()

    # Validate input paths
    import os

    if not os.path.isfile(args.data_csv):
        print(f"Error: data CSV file not found: {args.data_csv}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(args.metadata):
        print(f"Error: metadata JSON file not found: {args.metadata}", file=sys.stderr)
        sys.exit(1)

    # Load metadata
    try:
        with open(args.metadata, "r") as f:
            metadata = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error: failed to parse metadata JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Load data CSV
    try:
        df = pd.read_csv(args.data_csv)
    except Exception as e:
        print(f"Error: failed to read data CSV: {e}", file=sys.stderr)
        sys.exit(1)

    # Run analysis
    results = run_analysis(df, metadata)

    # Write output
    output_dir = os.path.dirname(args.output_json)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(args.output_json, "w") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"Analysis complete. Results written to: {args.output_json}")


if __name__ == "__main__":
    main()
