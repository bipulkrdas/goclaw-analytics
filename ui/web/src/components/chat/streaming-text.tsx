import { memo, useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { useArtifactStore } from "@/stores/use-artifact-store";

interface StreamingTextProps {
  text: string;
}

// Match a complete artifact tag (closed)
const ARTIFACT_CLOSED_RE = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+dependencies='([^']*)')?\s*>([\s\S]*?)<\/artifact>/;
// Match an opening artifact tag (streaming — not yet closed)
const ARTIFACT_OPEN_RE = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+dependencies='([^']*)')?\s*>([\s\S]+)$/;

export const StreamingText = memo(function StreamingText({ text }: StreamingTextProps) {
  const setArtifact = useArtifactStore((s) => s.setArtifact);
  const [artifactReady, setArtifactReady] = useState(false);

  // When an artifact is detected during streaming (closed or unclosed with content), push to store
  useEffect(() => {
    if (artifactReady) return;
    const match = text.match(ARTIFACT_CLOSED_RE) ?? text.match(ARTIFACT_OPEN_RE);
    // Only push if we have meaningful code content (>100 chars avoids partial open tags)
    if (match && match[4] && match[4].length > 100) {
      setArtifactReady(true);
      const deps = match[3] ? JSON.parse(match[3]) as Record<string, string> : {};
      setArtifact({ template: match[1]!, title: match[2] || "Live Preview", code: match[4]!, dependencies: deps });
    }
  }, [text, setArtifact, artifactReady]);

  if (!text) return <ThinkingIndicator />;

  // Strip artifact content from displayed text
  const hasArtifact = ARTIFACT_CLOSED_RE.test(text) || ARTIFACT_OPEN_RE.test(text);
  let displayText = text;
  if (hasArtifact) {
    displayText = displayText.replace(ARTIFACT_CLOSED_RE, "");
    displayText = displayText.replace(ARTIFACT_OPEN_RE, "");
    displayText = displayText.trim();
  }

  return (
    <div className="relative">
      {displayText && <MarkdownRenderer content={displayText} />}
      {hasArtifact && <ArtifactStreamingBadge complete={artifactReady} />}
      <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground align-text-bottom" />
    </div>
  );
});

function ArtifactStreamingBadge({ complete }: { complete: boolean }) {
  const openPanel = useArtifactStore((s) => s.openPanel);
  return (
    <button
      type="button"
      onClick={() => { console.log("[artifact] badge clicked, complete:", complete); if (complete) openPanel(); }}
      disabled={!complete}
      className="relative z-10 pointer-events-auto my-2 flex items-center gap-2 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 text-sm font-medium text-blue-700 hover:from-blue-100 hover:to-indigo-100 disabled:opacity-60 disabled:cursor-wait dark:from-blue-950 dark:to-indigo-950 dark:text-blue-300"
    >
      <LayoutDashboard className="h-4 w-4" />
      {complete ? "View Dashboard" : "Generating dashboard…"}
    </button>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </span>
    </div>
  );
}
