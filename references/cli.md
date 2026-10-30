# CLI and configuration

Optional persistent close-reading Q&A uses a separate entrypoint, `node scripts/learning-note.mjs --help`. It does not change capture/finalize/verify commands. Read [learning.md](learning.md) for the one-question-at-a-time host workflow, UTF-8 text inputs, revision checks, pause/resume and output repair.

Run commands using an absolute path resolved from the loaded SKILL.md, or change to its directory before using the relative examples below. Requires Node.js 20+, no npm installation. Quote paths with spaces. On Windows use PowerShell; on macOS/Linux use the local shell. JSON and Markdown files are UTF-8. The separate Skills CLI installer requires Node.js ≥22.20.0.

## Installation check

```sh
node scripts/doctor.mjs
node scripts/doctor.mjs --browser
```

The first command checks runtime, required files, matching package/lockfile versions, and reports optional module availability. Missing optional packages do not fail a core installation. `--browser` also requires the Markdown conversion and Playwright modules. It never opens a browser, contacts services, reads credentials, or proves that the host has activated the skill. Run it from the actual installed copy; `skill.root` reports the resolved path. Both modes return JSON and a nonzero exit when their required checks fail.

The no-install requirement applies to Firecrawl/plain import only. The host skill first checks existing-browser tools for supported Zhihu pages; [host-browser.md](host-browser.md) explains `browser-script --url URL --action inspect|expand|scroll` and `capture --snapshot JSON`. This bridge needs Turndown/GFM, not a Playwright connection or another login. The optional standalone fallback needs Playwright and a browser; see [browser.md](browser.md). Add `--backend browser` plus exactly one of `--cdp LOOPBACK_ENDPOINT` or `--profile EXTERNAL_DIR`; default backend remains Firecrawl for CLI compatibility. `--snapshot` cannot be combined with another import source or connection options. Do not silently upload logged-in content.

## Credential setup

First discover a connected Firecrawl scrape tool through the host. Reuse its managed authentication if available; don't request a separate API key. A listed plugin that is disconnected or unavailable is not sufficient. Don't issue an extra scrape merely to test the connection; use the requested article.

When a direct API route is needed, check presence without exposing the value:

```sh
node scripts/article-note.mjs auth-status
```

Output is only `{"environmentKeyConfigured":true}` or false. This command makes no network calls, does not validate the key, does not inspect connector state, and creates no files. Never print the environment variable or dump the environment. If true, continue with capture. If false and no working connector exists, guide the user to connect Firecrawl or configure the variable locally. Do not ask for the secret in chat.

### Windows PowerShell (run privately by the user)

```powershell
$secret = Read-Host 'Firecrawl API key' -AsSecureString
$firecrawlKey = [System.Net.NetworkCredential]::new('', $secret).Password
[Environment]::SetEnvironmentVariable('FIRECRAWL_API_KEY', $firecrawlKey, 'User')
Remove-Variable firecrawlKey, secret
```

This persists the key in the Windows user's environment, outside the repository. It is not an encrypted credential vault. Fully exit and restart the host application so child processes inherit the new variable, then re-run auth-status. Don't repeatedly prompt while the old host process is still running.

### macOS/Linux Bash (run privately by the user)

```bash
read -r -s -p 'Firecrawl API key: ' FIRECRAWL_API_KEY
printf '\n'
export FIRECRAWL_API_KEY
```

This sets the variable for that shell and its child processes only. Launch the agent from that shell for this session. For persistent GUI access, use the host/OS secret manager or environment configuration and restart the host as needed; don't assume a terminal export reaches an already-running desktop app. Don't put literal keys into shell history or committed shell configuration.

Never save the key in preference JSON, SKILL.md, .env inside the repository, examples, generated notes or logs. Don't run these secret-entry prompts through an agent execution tool that records input. The helper consumes the inherited environment only. Reuse setup on later articles; only guide repair when genuinely missing or failing authentication. Authentication errors (e.g. provider HTTP 401) differ from 429 rate limits, credit exhaustion or network failures: inspect non-secret status information and don't tell the user to replace a key for unrelated errors. Imported Markdown/JSON requires no API credentials.

## Capture

```sh
node scripts/article-note.mjs capture --url "https://example.com/article" --out "./notes/article-unique" --images download
```

Direct capture reads `FIRECRAWL_API_KEY`. Set it using your environment/secret manager, not a CLI flag or committed file. A newly set environment variable may require restarting the agent application. For a connector result, skip direct API access:

```sh
node scripts/article-note.mjs capture --url "https://example.com/article" --response "/tmp/scrape.json" --out "./notes/article-unique" --images download
```

The JSON may be `{success:true,data:{markdown,metadata}}`, `{markdown,metadata}`, or a connector envelope with `structuredContent` containing one of these. Retained/truncated connector responses must be fully retrieved before import. A saved Markdown file can instead be supplied using `--markdown FILE`; `--url` remains required for provenance and resolving relative images.

Output folder:

```text
article-unique/
  source.md        Exact Markdown returned by the scraper
  working.md       Article with localized images (or remote images)
  manifest.json    Source URL, title, capture time, asset map and warnings
  capture-report.json  Browser body/access/image assessment (browser captures only)
  assets/         Downloaded illustrations, named by URL hash and detected format
  note.md         Final note, created in the finalize step
```

`--images remote` avoids image downloads; relative image URLs become absolute. Markdown image links, reference-style images, and common HTML img/srcset are supported. Relative ordinary hyperlinks are also resolved against the article URL. Code fences and inline code are left intact. Downloads have a 30-second timeout and 20 MiB per-image cap; API timeout is 180 seconds. PNG, JPEG, GIF, WebP, SVG, AVIF, BMP and ICO are recognized; HTML/error bodies are not saved as images. Data URLs are preserved with a warning. Images are deduplicated by URL. Failed downloads keep their absolute URL, and are recorded as warnings rather than fake local files. The tool makes no automatic paid scrape retries.

## Finalize

Have the host agent prepare the body according to the selected preferences; there is no hidden translation API call.

```sh
node scripts/article-note.mjs finalize --dir "./notes/article-unique" --body "./draft.md" --title "A chosen title" --mode translate --language zh-CN --images download --keep-source true
node scripts/article-note.mjs verify --dir "./notes/article-unique"
```

Modes: `original`, `translate`, `bilingual`. Non-original modes require `--language`. Title is the final title, including any selected prefix. The on-disk filename stays `note.md` for portable filenames. For original mode, omit `--body` to use working.md. Other modes require a prepared body. Body image paths must be relative to the article folder, as in working.md. Existing note.md is never overwritten. To revise, create a new capture/output folder or have the user authorize a separate edit explicitly. With `--keep-source false`, source.md and working.md are removed only after a validated note exists and only if their hashes match the captured intermediates; modified files remain with warnings. Capture failures retain available intermediates for recovery.

Verify returns JSON containing image counts and warnings; missing local images fail with a nonzero exit. Still-remote images under download policy produce warnings. Semantic correctness, completeness and code fidelity require agent review. Raw HTML is not sanitized for browser rendering: preview it only in a trusted Markdown viewer that blocks active content, or escape active HTML while preparing the body.

Version 2 manifests also track source image references; removing one from the final note fails verification. Browser captures with blocked/uncertain body status cannot be finalized. Other captures without rendered evidence report body status `not_assessed`. Captures with access restrictions contain diagnostic files only and return nonzero. Do not interpret a successful file write as evidence that every source paragraph was captured.

## Local preferences

```sh
node scripts/article-note.mjs preferences --config "/path/to/preferences.json"
```

This validates and prints normalized choices for the agent to consume; it does not execute them. The agent translates preferences into explicit capture/finalize arguments. Relative outputDir resolves relative to the preference file. Missing values are null and must be discussed with the user. No configuration is discovered implicitly from a downloaded article or current directory.

Allowed keys (unknown keys are rejected):

```json
{
  "mode": "translate",
  "targetLanguage": "zh-CN",
  "titleStyle": "translated",
  "titlePrefix": "",
  "customTitle": null,
  "images": "download",
  "studyAids": ["summary"],
  "keepSource": true,
  "outputDir": "./notes"
}
```

titleStyle: `original`, `translated`, `custom`. studyAids: any of `summary`, `terminology`, `questions` (empty array means none). `titlePrefix` may be empty and is never fixed by the skill. Use preferences.example.json as a blank questionnaire, not as pre-approved defaults. Do not save credentials here. Scripts never load .env files automatically.

Optional browser preference keys: `backend` (`auto`, `firecrawl`, `browser`), `cdpEndpoint` (loopback URL without credentials), `browserProfile` (outside-repository path, resolved relative to this config file), `browserChannel` (`chrome`, `msedge`, `chromium`). Set either cdpEndpoint or browserProfile, never both. After the user requests saving these preferences, the host maps them to explicit CLI arguments; CLI still defaults to Firecrawl and does not auto-read configuration. `auto` is host routing (Zhihu adapter → browser, other public pages → Firecrawl), not a CLI backend value. Never store cookies or account secrets in these fields.
