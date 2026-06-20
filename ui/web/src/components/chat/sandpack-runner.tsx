import { useRef, useEffect } from "react";

interface SandpackRunnerProps {
  code: string;
  dependencies: Record<string, string>;
  height: string;
}

/**
 * Renders React/TSX code in an iframe using esm.sh for dependencies.
 * Uses blob URL to avoid inheriting parent page CSP restrictions.
 */
export default function SandpackRunner({ code, dependencies, height }: SandpackRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const resolvedHeight = height === "100%" ? "calc(85vh - 80px)" : height;

  // Ensure React is imported
  let finalCode = code.trim();
  if (!/import\s+React[\s,]/.test(finalCode)) {
    finalCode = 'import React from "react";\n' + finalCode;
  }

  // Strip TypeScript type annotations that Babel standalone can't handle:
  // - Function param types: `({ a, b }: { a: string; b: number })` → `({ a, b })`
  // - Variable type annotations: `const x: string[] = ` → `const x = `
  // - Return types: `): JSX.Element {` → `) {`
  // - Type casts: `as string` → removed
  // - Generic type params on functions: `function foo<T>` → `function foo`
  finalCode = finalCode
    .replace(/\}:\s*\{[^}]*\}/g, '}')                    // destructured param types
    .replace(/:\s*React\.\w+(\[\])?/g, '')               // React.ReactNode etc
    .replace(/:\s*\(\s*\{[^}]*\}\s*\)/g, '')             // inline object type in parens
    .replace(/<(\w+),\s*(\w+)>/g, '')                    // generic type params like <T, U>
    .replace(/\)\s*:\s*[\w.[\]|<>, ]+\s*\{/g, ') {')    // return type annotations
    .replace(/as\s+\w+(\[\])?/g, '')                     // type casts
    .replace(/:\s*(string|number|boolean|any)(\[\])?\s*(;|\}|,|\))/g, '$3')  // simple type annotations
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')         // interface declarations
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');           // type aliases

  // Build import map from dependencies
  const importMap = {
    imports: {
      "react": "https://esm.sh/react@18",
      "react-dom": "https://esm.sh/react-dom@18",
      "react-dom/client": "https://esm.sh/react-dom@18/client",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
      ...Object.fromEntries(
        Object.entries(dependencies).map(([pkg, ver]) => [
          pkg,
          `https://esm.sh/${pkg}@${ver.replace("^", "")}?external=react,react-dom`,
        ])
      ),
    },
  };

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script type="importmap">${JSON.stringify(importMap)}<\/script>
<style>body{margin:0}#root{min-height:100vh}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-type="module" data-presets="react">
${finalCode}

import ReactDOM from "react-dom/client";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
<\/script>
</body>
</html>`;

  useEffect(() => {
    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [htmlContent]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      style={{ width: "100%", height: resolvedHeight, border: "none" }}
      title="Dashboard Preview"
    />
  );
}
