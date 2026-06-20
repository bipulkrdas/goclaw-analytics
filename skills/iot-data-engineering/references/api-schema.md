# myDevices API Schema Reference

## Endpoints

### 1. Get Device Details

```
GET /v1.0/admin/things/{thing_id}
```

**Response (key fields):**
```json
{
  "id": 4205892,
  "cayenne_id": "d60c5cc0-5931-11f1-94d3-297a7f671e3c",
  "thing_name": "Air conditioning unit",
  "sensor_type": "Electric Meter",
  "device_type_id": "503e9680-9cfe-11ef-ab39-af8ef6cf829f",
  "properties": "{\"codec.voltage\":120, \"codec.power_factor\":1, \"child.127.unit\":\"kw\", \"codec.timezone\":\"America/New_York\", \"codec.wires\":1, \"codec.interval\":15, \"codec.threshold\":1, \"codec.reset\":24}"
}
```

**Note:** `properties` is a JSON-encoded string. Parse it to access device configuration.

---

### 2. Get Device Type

```
GET /v1.0/things/types/{device_type_id}
```

**Response (key fields):**
```json
{
  "id": "503e9680-9cfe-11ef-ab39-af8ef6cf829f",
  "name": "Vutility HotDrop 5.0",
  "manufacturer": "Vutility",
  "channels": [
    {
      "channel": "126",
      "name": "Current",
      "data": {
        "units": [
          {"label": "Ampere", "payload": "a", "display": " A", "default": true}
        ],
        "statuses": [],
        "template": "value"
      }
    },
    {
      "channel": "511",
      "name": "Device Status",
      "data": {
        "statuses": [
          {"value": "1", "label": "Normal"},
          {"value": "0", "label": "Failure"}
        ],
        "template": "status"
      }
    }
  ]
}
```

**Key observations:**
- `channels[].channel` is the channel number (string)
- `channels[].name` is the human-readable name (use this for pattern matching)
- `channels[].data.units[]` provides unit info; use the one with `"default": true`
- `channels[].data.statuses[]` provides status code → label mapping for enum channels
- `channels[].data.template` is "value" for numeric or "status" for enum

---

### 3. Get Readings

```
GET /v1.0/admin/things/{cayenne_id}/readings?start_ts={start_ms}&end_ts={end_ms}
```

**Parameters:**
- `start_ts` — epoch milliseconds (start of range)
- `end_ts` — epoch milliseconds (end of range)

**Response:**
```json
{
  "timestamp": "1781228857895,511",
  "count_took": 44,
  "took": 1619,
  "units": [
    {"sensor_id": "...", "channel": "126", "from": "a"},
    {"sensor_id": "...", "channel": "127", "from": "w"}
  ],
  "readings": [
    {
      "ts": 1781280640022,
      "correlation_id": "uuid",
      "sensors": [
        {"v": 5.6, "event": "uplink", "channel": "126"},
        {"v": 672, "event": "uplink", "channel": "127"},
        {"v": 1, "value_text": "01:30:01", "event": "uplink", "channel": "507"}
      ]
    }
  ]
}
```

**Key observations:**
- `readings` array is ordered **newest-first** — sort ascending for time-series
- Each reading has `ts` (epoch ms) and `sensors[]` array
- `sensors[].v` is the numeric value
- `sensors[].value_text` is used for time-duration channels (format: "HH:MM:SS")
- `sensors[].channel` matches the channel number from device type
- Not all channels appear in every reading — handle missing gracefully
- `units[].from` tells you the raw unit the API returns values in
