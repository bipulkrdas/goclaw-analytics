import { useState, useCallback, lazy, Suspense } from "react";
import { Copy, Download, Code, Eye, Check } from "lucide-react";
import { useArtifactStore } from "@/stores/use-artifact-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SandpackRunner = lazy(() => import("./sandpack-runner"));

export function ArtifactPanel() {
  const { artifact, open, closePanel } = useArtifactStore();
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  console.log("[artifact-panel] render, open:", open, "artifact:", !!artifact);

  const handleCopy = useCallback(() => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  const handleDownload = useCallback(() => {
    if (!artifact) return;
    const blob = new Blob([artifact.code], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "App.tsx";
    a.click();
    URL.revokeObjectURL(url);
  }, [artifact]);

  if (!artifact) return null;

  console.log("[artifact-panel] render, open:", open, "has artifact:", !!artifact, "code length:", artifact.code?.length);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closePanel(); }}>
      <DialogContent className="max-sm:inset-0 sm:max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between gap-2">
          <DialogTitle className="truncate text-base">{artifact.title}</DialogTitle>
          <div className="mr-8 flex items-center gap-1">
            <button type="button" onClick={() => setShowCode((v) => !v)} className="rounded p-1.5 hover:bg-muted" title={showCode ? "Preview" : "View Code"}>
              {showCode ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
            </button>
            <button type="button" onClick={handleCopy} className="rounded p-1.5 hover:bg-muted" title="Copy code">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
            <button type="button" onClick={handleDownload} className="rounded p-1.5 hover:bg-muted" title="Download">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden rounded-md border">
          {showCode ? (
            <pre className="h-full overflow-auto bg-muted/20 p-4 text-xs font-mono">
              <code>{artifact.code}</code>
            </pre>
          ) : (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading preview…</div>}>
              <SandpackRunner code={artifact.code} dependencies={artifact.dependencies} height="100%" />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
