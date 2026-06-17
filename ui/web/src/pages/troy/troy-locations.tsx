import { useEffect, useState, useCallback } from "react";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { useHttp } from "@/hooks/use-ws";
import { cn } from "@/lib/utils";

interface Location {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
}

interface LocationsResponse {
  count: number;
  limit: number;
  page: number;
  rows: Location[];
}

interface TroyLocationsProps {
  activeLocationId?: string;
  onSelect: (id: string) => void;
}

export function TroyLocations({ activeLocationId, onSelect }: TroyLocationsProps) {
  const http = useHttp();
  const [data, setData] = useState<LocationsResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLocations = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const result = await http.get<LocationsResponse>("/v1/troy/locations", {
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
    [http],
  );

  useEffect(() => {
    fetchLocations(page);
  }, [page, fetchLocations]);

  const totalPages = data ? Math.ceil(data.count / data.limit) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Locations</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !data && (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading...</div>
        )}
        {data?.rows.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onSelect(String(loc.id))}
            className={cn(
              "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
              activeLocationId === String(loc.id) && "bg-accent font-medium",
            )}
          >
            <div className="truncate">{loc.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {loc.city}{loc.state ? `, ${loc.state}` : ""}
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
