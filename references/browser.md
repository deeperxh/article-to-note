# Local browser capture (Zhihu v0.2.1)

**First choice is the user's existing browser through the host's browser/extension tools.** Follow [host-browser.md](host-browser.md) before requesting CDP or a dedicated profile. No debugging port is needed when the host can already access the logged-in tab. The standalone CLI modes below are fallbacks, not mandatory onboarding for all users.

Supported URLs:
- `https://www.zhihu.com/question/QUESTION_ID/answer/ANSWER_ID`
- `https://zhuanlan.zhihu.com/p/ARTICLE_ID`

Question lists, user archives and paid-story/App extraction are not implemented. Adapter selectors are heuristics for rendered desktop Zhihu pages and may require updates. Live-site compatibility has not yet been validated against the user's logged-in session; automated tests use synthetic pages in real Chrome.

## Dependencies

In the skill directory run `npm ci` (or `npm install` if no lockfile). Browser support uses optional Playwright, Turndown and GFM packages. Existing Firecrawl/import operations can still run without them (`npm ci --omit=optional`). Use installed Chrome (default) or Edge (`--channel msedge`). For Playwright Chromium install it locally using `npx playwright install chromium` and select `--channel chromium`.

These commands do not install a browser extension or extract account credentials. To check optional dependencies without opening a browser:

```sh
node --input-type=module -e "import('./scripts/browser-capture.mjs').then(m => m.browserLibraries()).then(() => console.log('Browser dependencies ready'))"
```

## Fallback: reuse a browser session via CDP

The user provides a loopback-only CDP endpoint from a browser they explicitly enabled for this task. The tool does not discover ports or attach to an arbitrary browser. Modern Chrome configurations generally require a dedicated non-default user-data directory for remote debugging. Log into Zhihu manually in this dedicated browser once; later runs reuse that profile. The default already-running Chrome session is not automatically accessible.

Windows PowerShell example (run by the user; adjust the executable if necessary):

```powershell
$profilePath = Join-Path $env:LOCALAPPDATA 'article-to-note/browser-profile'
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  '--remote-debugging-address=127.0.0.1' '--remote-debugging-port=9222' `
  "--user-data-dir=$profilePath" 'https://www.zhihu.com/'
```

macOS example:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/article-to-note/browser-profile" https://www.zhihu.com/
```

Linux example (use the locally installed Chrome/Chromium executable):

```sh
google-chrome --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="$HOME/.local/share/article-to-note/browser-profile" https://www.zhihu.com/
```

Keep the debugging endpoint local and close that browser when no longer needed. Anyone able to access its debugging endpoint may control its session. Do not publish the profile, cookies, endpoint tokens or account data.

To avoid asking again, the user may explicitly save `backend: "auto"` and either `cdpEndpoint` or `browserProfile` in their selected external preference JSON. The host then reuses that setting on later invocations. A saved endpoint is not proof the browser is still running; connection failure should prompt reopening that dedicated browser, not another login or Firecrawl-key request. Browser preferences contain paths/loopback connection information only, never account credentials.

After the user has logged in, run:

```sh
node scripts/article-note.mjs capture --backend browser --url "https://www.zhihu.com/question/123/answer/456" --out "./notes/answer-456" --images download --cdp "http://127.0.0.1:9222"
```

If the target article is already open, reuse that tab and restore its scroll position after extraction. Otherwise create a temporary tab and close only that tab afterwards. Disconnect from CDP without closing the user's browser. Normal content expansion changes that page's UI; it does not post, like, comment, or purchase.

## Dedicated persistent profile without CDP

```sh
node scripts/article-note.mjs capture --backend browser --url "https://zhuanlan.zhihu.com/p/987" --out "./notes/article-987" --images download --profile "/absolute/path/outside-the-repository/browser-profile" --channel chrome
```

This opens a visible browser with the supplied profile, then closes that tool-owned context after extraction. Use a profile previously initialized with a manual login (for example via the CDP browser above, after that browser is closed). Never use a profile already open in another process. The tool refuses a profile directory inside this skill repository. It never copies your default browser profile or exports storage state.

## Completeness report and access boundaries

`capture-report.json` contains:
- adapter and access status;
- rendered body character/paragraph counts, heading list and code-block count;
- remaining expand controls, CSS clipping or preview markers, and whether bounded scrolling reached stability;
- expected image URLs, browser loading state, download failures and image-reference coverage;
- explicit heuristic limitation.

Statuses:
- `apparently_complete`: rendered body stabilized without detected clipping/preview. Not proof that the server delivered everything.
- `needs_review`: unresolved collapse, clipping, missing image URLs or exhausted loading budget. Source is retained; finalize is blocked. Inspect the page and capture again into a new directory.
- `login_required`, `verification_required`, `paywall`, `content_not_found`, `ambiguous_answer`, `unexpected_redirect`: diagnostic output only, CLI returns nonzero, no normal article source/note is created.

No login automation, CAPTCHA solving, stealth patches, hidden paid-content extraction, private API replay or paywall bypass is provided. A membership does not imply every story has a usable web full-text view. If only a preview is available, report it and stop full-article generation.

Images prefer original/lazy-load attributes and convert Zhihu formula images to inline LaTeX. Browser-session image requests are limited to Zhihu/zhimg hosts; redirects are not followed with session credentials. Other images use ordinary fetch without browser credentials. No cookies or page-wide HTML snapshots are written to the output. Markdown and reports still contain the selected article, author and public asset URLs and should be treated according to the article's permissions. Captured content is sent to the host model for translation if selected; “local extraction” does not imply the host model runs locally.

The final note must retain all captured image references; verify rejects missing local files and omitted source images. It warns about failed downloads and still-remote images. It cannot verify translation fidelity or prove original text coverage from different languages.

## Tests

`npm test` runs core and browser tests. Browser tests require installed Google Chrome by default. To use installed Edge set `ARTICLE_NOTE_TEST_CHANNEL=msedge`; to use Playwright's downloaded Chromium set it to `chromium`. Tests use isolated temporary profiles, synthetic Zhihu pages and a local image server; no real accounts, live Zhihu, Firecrawl credits or paid content.

API references: [Playwright CDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp), [Turndown](https://github.com/mixmark-io/turndown).
