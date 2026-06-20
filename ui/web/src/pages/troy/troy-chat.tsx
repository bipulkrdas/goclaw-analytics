import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/use-auth-store";
import { useHttp } from "@/hooks/use-ws";
import { ChatThread } from "../chat/chat-thread";
import { ChatInput, type AttachedFile } from "@/components/chat/chat-input";
import { ChatTopBar } from "@/components/chat/chat-top-bar";
import { useChatMessages } from "../chat/hooks/use-chat-messages";
import { useChatSend } from "../chat/hooks/use-chat-send";
import { parseSessionKey } from "@/lib/session-key";

interface TroyChatProps {
  sessionKey: string;
  assetId: string;
  assetType: string;
  isNewSession: boolean;
  onAssociationCreated: () => void;
  onResponseComplete: () => void;
}

export function TroyChat({ sessionKey, assetId, assetType, isNewSession, onAssociationCreated, onResponseComplete }: TroyChatProps) {
  const connected = useAuthStore((s) => s.connected);
  const http = useHttp();
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const associationCreated = useRef<string | null>(null);

  const agentId = useMemo(() => {
    const { agentId: parsed } = parseSessionKey(sessionKey);
    return parsed || "";
  }, [sessionKey]);

  const {
    messages,
    streamText,
    thinkingText,
    toolStream,
    isRunning,
    isBusy,
    loading,
    activity,
    blockReplies,
    teamTasks,
    expectRun,
    addLocalMessage,
  } = useChatMessages(sessionKey, agentId);

  // Refresh sessions list when agent finishes responding (label now available)
  const prevIsBusyRef = useRef(false);
  useEffect(() => {
    if (prevIsBusyRef.current && !isBusy) {
      onResponseComplete();
    }
    prevIsBusyRef.current = isBusy;
  }, [isBusy, onResponseComplete]);

  const handleMessageAdded = useCallback(
    (msg: { role: "user" | "assistant" | "tool"; content: string; timestamp?: number }, key?: string) => {
      addLocalMessage(msg, key);
    },
    [addLocalMessage],
  );

  const { send, abort, error: sendError } = useChatSend({
    agentId,
    onMessageAdded: handleMessageAdded,
    onExpectRun: expectRun,
  });

  const handleSend = useCallback(
    (message: string, sendFiles?: AttachedFile[]) => {
      send(message, sessionKey, sendFiles);
      setScrollTrigger((n) => n + 1);
      // Create asset_sessions association only for newly initiated chats, once
      if (isNewSession && associationCreated.current !== sessionKey) {
        associationCreated.current = sessionKey;
        http.post("/v1/troy/asset-sessions", { assetId, assetType, sessionKey }).then(() => {
          onAssociationCreated();
        }).catch(() => {
          associationCreated.current = null;
        });
      }
    },
    [sessionKey, send, http, assetId, assetType, isNewSession, onAssociationCreated],
  );

  const handleAbort = useCallback(() => {
    abort(sessionKey);
  }, [abort, sessionKey]);

  if (!agentId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Invalid session key format
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0">
        <ChatTopBar
          agentId={agentId}
          isRunning={isRunning}
          isBusy={isBusy}
          activity={activity}
          teamTasks={teamTasks}
          onToggleTaskPanel={() => {}}
          taskPanelOpen={false}
          session={null}
        />
      </div>

      {sendError && (
        <div className="shrink-0 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <ChatThread
        messages={messages}
        streamText={streamText}
        thinkingText={thinkingText}
        toolStream={toolStream}
        blockReplies={blockReplies}
        activity={activity}
        teamTasks={teamTasks}
        isRunning={isRunning}
        isBusy={isBusy}
        loading={loading}
        scrollTrigger={scrollTrigger}
        onToggleTaskPanel={() => {}}
      />

      <ChatInput
        onSend={handleSend}
        onAbort={handleAbort}
        isBusy={isBusy}
        disabled={!connected}
        files={files}
        onFilesChange={setFiles}
      />
    </>
  );
}
