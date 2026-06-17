import { useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { TroyLocations } from "./troy-locations";
import { TroyAssets } from "./troy-assets";
import { TroySessions } from "./troy-sessions";
import { TroyChat } from "./troy-chat";

export function TroyPage() {
  const { locationId, assetId, sessionKey } = useParams<{
    locationId?: string;
    assetId?: string;
    sessionKey?: string;
  }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleLocationSelect = useCallback(
    (id: string) => {
      navigate(`/troy/${id}`);
    },
    [navigate],
  );

  const handleAssetSelect = useCallback(
    (id: string) => {
      if (locationId) {
        navigate(`/troy/${locationId}/${id}`);
      }
    },
    [navigate, locationId],
  );

  const handleSessionSelect = useCallback(
    (key: string) => {
      if (locationId && assetId) {
        navigate(`/troy/${locationId}/${assetId}/${encodeURIComponent(key)}`);
      }
    },
    [navigate, locationId, assetId],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Column 1: Locations */}
      <div
        className={cn(
          "flex-shrink-0 border-r overflow-y-auto overscroll-contain",
          isMobile ? "w-full" : "w-56",
          isMobile && locationId && "hidden",
        )}
      >
        <TroyLocations
          activeLocationId={locationId}
          onSelect={handleLocationSelect}
        />
      </div>

      {/* Column 2: Assets (devices + location header) */}
      {locationId && (
        <div
          className={cn(
            "flex-shrink-0 border-r overflow-y-auto overscroll-contain",
            isMobile ? "w-full" : "w-56",
            isMobile && assetId && "hidden",
          )}
        >
          <TroyAssets
            locationId={locationId}
            activeAssetId={assetId}
            onSelect={handleAssetSelect}
          />
        </div>
      )}

      {/* Column 3: Chat Sessions */}
      {assetId && (
        <div
          className={cn(
            "flex-shrink-0 border-r overflow-y-auto overscroll-contain",
            isMobile ? "w-full" : "w-64",
            isMobile && sessionKey && "hidden",
          )}
        >
          <TroySessions
            assetId={assetId}
            assetType={assetId === locationId ? "location" : "device"}
            activeSessionKey={sessionKey}
            onSelect={handleSessionSelect}
          />
        </div>
      )}

      {/* Column 4: Chat Messages */}
      {sessionKey && (
        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          <TroyChat
            sessionKey={decodeURIComponent(sessionKey)}
            assetId={assetId!}
            assetType={assetId === locationId ? "location" : "device"}
          />
        </div>
      )}

      {/* Empty state when nothing selected */}
      {!locationId && !isMobile && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Select a location to get started
        </div>
      )}
      {locationId && !assetId && !isMobile && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Select an asset to view chat sessions
        </div>
      )}
      {assetId && !sessionKey && !isMobile && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Select or create a chat session
        </div>
      )}
    </div>
  );
}
