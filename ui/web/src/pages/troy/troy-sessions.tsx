import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { useHttp } from "@/hooks/use-ws";
import { useWsEvent } from "@/hooks/use-ws-event";
import { Events } from "@/api/protocol";
import { cn, uniqueId } from "@/lib/utils";
import { AgentSelector } from "@/components/chat/agent-selector";

interface AssetSession {
  id: string;
  assetId: string;
  assetType: string;
  sessionKey: string;
  label?: string;
  messageCount?: number;
  createdAt: string;
}

interface TroySessionsProps {
  assetId: string;
  assetType: "location" | "device";
  activeSessionKey?: string;
  onSelect: (key: string) => void;
}

export function TroySessions({
  assetId,
  assetType,
  activeSessionKey,
  onSelect,
}: TroySessionsProps) {
  const http = useHttp();
  const [sessions, setSessions] = useState<AssetSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await http.get<{ sessions: AssetSession[] }>("/v1/troy/asset-sessions", {
        asset_id: assetId,
        asset_type: assetType,
      });
      setSessions(result.sessions || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [http, assetId, assetType]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Update session label when backend generates a title after first message
  const handleSessionUpdated = useCallback((payload: unknown) => {
    const event = payload as { sessionKey?: string; label?: string };
    if (!event?.sessionKey || !event?.label) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.sessionKey === event.sessionKey ? { ...s, label: event.label } : s,
      ),
    );
  }, []);
  useWsEvent(Events.SESSION_UPDATED, handleSessionUpdated);

  const handleNewChat = useCallback(() => {
    setShowAgentPicker(true);
  }, []);

  const handleAgentSelected = useCallback(
    (agentId: string) => {
      const convId = uniqueId();
      const sessionKey = `agent:${agentId}:ws:direct:${convId}`;
      // Navigate immediately — session created by backend on first message.
      // Association created by TroyChat after first message is sent.
      onSelect(sessionKey);
      setShowAgentPicker(false);
    },
    [onSelect],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chat Threads</span>
        </div>
        <button
          onClick={handleNewChat}
          className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading...</div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No chat sessions yet. Click + to start one.
          </div>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.sessionKey)}
            className={cn(
              "w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b border-border/50",
              activeSessionKey === session.sessionKey && "bg-accent font-medium",
            )}
          >
            <div className="truncate">
              {session.label || "New conversation"}
            </div>
            <div className="text-xs text-muted-foreground">
              {session.messageCount ? `${session.messageCount} messages · ` : ""}
              {new Date(session.createdAt).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>

      {showAgentPicker && (
        <AgentPickerModal
          onSelect={handleAgentSelected}
          onClose={() => setShowAgentPicker(false)}
        />
      )}
    </div>
  );
}

function AgentPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (agentId: string) => void;
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="rounded-lg bg-background border p-4 shadow-lg w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium mb-3">Select Agent for New Chat</h3>
        <div className="mb-3">
          <AgentSelector value={agentId} onChange={setAgentId} />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => agentId && onSelect(agentId)}
            disabled={!agentId}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}
