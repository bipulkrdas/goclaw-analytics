import{s as e}from"./chunk-Bj-mKKzh.js";import{n as t,t as n}from"./jsx-runtime-Bs4MhNha.js";var r=e(t(),1),i=n();function a({code:e,dependencies:t,height:n}){let a=(0,r.useRef)(null),o=(0,r.useRef)(null),s=n===`100%`?`calc(85vh - 80px)`:n,c=e.trim();/import\s+React[\s,]/.test(c)||(c=`import React from "react";
`+c),c=c.replace(/\}:\s*\{[^}]*\}/g,`}`).replace(/:\s*React\.\w+(\[\])?/g,``).replace(/:\s*\(\s*\{[^}]*\}\s*\)/g,``).replace(/<(\w+),\s*(\w+)>/g,``).replace(/\)\s*:\s*[\w.[\]|<>, ]+\s*\{/g,`) {`).replace(/as\s+\w+(\[\])?/g,``).replace(/:\s*(string|number|boolean|any)(\[\])?\s*(;|\}|,|\))/g,`$3`).replace(/interface\s+\w+\s*\{[^}]*\}/g,``).replace(/type\s+\w+\s*=\s*[^;]+;/g,``);let l={imports:{react:`https://esm.sh/react@18`,"react-dom":`https://esm.sh/react-dom@18`,"react-dom/client":`https://esm.sh/react-dom@18/client`,"react/jsx-runtime":`https://esm.sh/react@18/jsx-runtime`,...Object.fromEntries(Object.entries(t).map(([e,t])=>[e,`https://esm.sh/${e}@${t.replace(`^`,``)}?external=react,react-dom`]))}},u=`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script type="importmap">${JSON.stringify(l)}<\/script>
<style>body{margin:0}#root{min-height:100vh}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-type="module" data-presets="react">
${c}

import ReactDOM from "react-dom/client";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
<\/script>
</body>
</html>`;return(0,r.useEffect)(()=>{o.current&&URL.revokeObjectURL(o.current);let e=new Blob([u],{type:`text/html`}),t=URL.createObjectURL(e);return o.current=t,a.current&&(a.current.src=t),()=>{o.current&&=(URL.revokeObjectURL(o.current),null)}},[u]),(0,i.jsx)(`iframe`,{ref:a,sandbox:`allow-scripts`,style:{width:`100%`,height:s,border:`none`},title:`Dashboard Preview`})}export{a as default};