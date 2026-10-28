# Reuse the user's existing browser first

This is a host-orchestrated route, not another browser launched by Node. It can reuse a logged-in Chrome/Edge tab through a host browser extension or equivalent browser-control tool, without a debugging port, new profile or another login. It does not require Playwright to attach to that browser. The host remains responsible for following its browser tool's documentation, permissions and supported APIs.

## Discover before asking for setup

1. Discover the host's available browser-control tools, including extension-based access to existing tabs. Initialize them using their documented inventory operation. For example, if cua_repl is available its documented entry point is `await cua.getState()`; read the returned documentation before further calls. Other hosts may use different APIs. Do not assume tool names, browser IDs or unsupported capabilities.
2. Search the permitted inventory for the exact target URL. Read only the relevant tab. If several browsers expose the same article with materially different accounts/content, ask which one to use. If no target tab exists but a normal browser is accessible, open the supplied URL in that browser using supported tools; don't create a fresh profile first. An embedded/in-app browser may have separate login state, so prefer the normal logged-in browser requested by the user.
3. If access succeeds, continue immediately. No separate CDP configuration or repeated permission/login question is needed just because the helper script doesn't attach to that browser. If browser access requires enabling an extension, explain that actual requirement and offer it before a dedicated-profile login.
4. Only after tools report no suitable access, explain the limitation and offer CDP or a dedicated profile. A failed fresh-profile login is not proof the existing browser is logged out.

## Shared extractor and evidence bridge

Read `scripts/zhihu.mjs` for the DOM extractor and supported selectors. To obtain a self-contained function literal for the host's documented DOM-evaluation API:

```sh
node scripts/article-note.mjs browser-script --url "https://zhuanlan.zhihu.com/p/987" --action inspect
```

`--action expand` produces the normal article-expansion operation and `--action scroll` the bounded article scrolling operation. Run those only if the preceding inspection is readable and indicates normal collapsed/lazy content. Stop on login, verification or paywall evidence. These functions do not read cookies/storage or issue API requests.

Pass the function literal to the host's supported DOM evaluation API (some tools require an element-scoped function; adapt its wrapper while retaining the extractor's logic). Do not use eval, import Node libraries, read files, or perform shell/network operations inside a restricted browser tool runtime. Read generated function text through ordinary file/command tools, perform browser operations through the host tools, and write returned JSON using ordinary file-writing tools. If evaluation is not supported, use permitted DOM/snapshot tools; report that equivalent evidence is unavailable rather than fabricating a shared-extractor result.

Inspect, expand normal content if needed, and scroll in viewport-sized increments. Stop after at most 32 rounds. After reaching the article's end, take three consecutive observations separated by short waits or browser-tool round trips, with no further content changes. Each inspection returns the source page URL, text, scoped HTML, image URLs/loading state, heading/code/paragraph counts, access issues, scroll position and atBodyEnd. Restore the prior scroll position when the tool supports it and leave existing tabs open.

Write the final three observed objects verbatim to a temporary file outside the repository and output note:

```json
{"snapshots": ["actual first observation object", "actual second observation object", "actual third observation object"]}
```

The strings above are explanatory placeholders: the real array must contain the actual JSON objects returned by inspect, not strings. For a blocked page, one observation suffices for diagnostic output. Do not set settled=true yourself or invent unobserved fields. Then run:

```sh
node scripts/article-note.mjs capture --url "https://zhuanlan.zhihu.com/p/987" --snapshot "/temporary/host-snapshots.json" --out "./notes/article-987" --images download
```

The importer validates the target URL and computes stability from three matching observations at the article end. It converts the scoped HTML through the same Markdown converter as the Playwright route, and generates capture-report.json with transport=host-browser. Missing/unstable evidence produces needs_review; it is not silently upgraded to full capture. Temporary scoped HTML may contain article text; keep it local and remove the generated temp file after successful processing. Do not save a browser-wide HTML dump, cookies or account data.

Image downloads in this imported route use ordinary HTTP without browser cookies. If a protected image fails, leave its URL and report it. A host-provided, documented download API may save the image locally with the existing session; then verify actual files and update the manifest consistently. Do not export cookies or switch to a remote service to obtain session-protected images.

If the host only provides text/Markdown extraction, `--markdown`/`--response` remains available, but it must be reported as body completeness not_assessed. Explicitly describe missing checks; don't claim the browser adapter's complete inspection was run. Host-browser control is a capability supplied by the host, not a guarantee that every Agent product can access ordinary browser tabs.
