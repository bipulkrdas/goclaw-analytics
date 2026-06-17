import { useEffect, useState, useCallback } from "react";
import { Cpu, ChevronLeft, ChevronRight, MapPin, MoreVertical } from "lucide-react";
import { useHttp } from "@/hooks/use-ws";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  thing_name: string;
  sensor_type: string;
  sensor_use: string;
  location_id: number;
}

interface DevicesResponse {
  count: number;
  limit: number;
  page: number;
  rows: Device[];
}

interface TroyAssetsProps {
  locationId: string;
  activeAssetId?: string;
  onSelect: (id: string) => void;
}

export function TroyAssets({ locationId, activeAssetId, onSelect }: TroyAssetsProps) {
  const http = useHttp();
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const result = await http.get<DevicesResponse>("/v1/troy/devices", {
          location_id: locationId,
          page: String(p),
          limit: "50",
        });
        setData(result);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [http, locationId],
  );

  useEffect(() => {
    setPage(0);
    fetchDevices(0);
  }, [locationId, fetchDevices]);

  const totalPages = data ? Math.ceil(data.count / data.limit) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Cpu className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Assets</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Location item at top - clickable as an asset itself */}
        <button
          onClick={() => onSelect(locationId)}
          className={cn(
            "w-full px-3 py-2 text-left text-sm border-b bg-muted/30 hover:bg-accent transition-colors flex items-center gap-2",
            activeAssetId === locationId && "bg-accent font-medium",
          )}
        >
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">Location #{locationId}</span>
          <AssetMenu />
        </button>

        {loading && !data && (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading...</div>
        )}
        {data?.rows.map((device) => (
          <button
            key={device.id}
            onClick={() => onSelect(device.id)}
            className={cn(
              "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors group",
              activeAssetId === device.id && "bg-accent font-medium",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="truncate flex-1">{device.thing_name}</div>
              <AssetMenu />
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {device.sensor_type} • {device.sensor_use}
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-1.5">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Dropdown menu stub for Analysis / Chart / Chat actions */
function AssetMenu() {
  return (
    <div className="relative">
      <button
        className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        title="Actions"
      >
        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
