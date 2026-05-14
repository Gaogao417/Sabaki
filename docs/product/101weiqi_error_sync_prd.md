# PRD: 101 Weiqi Wrong-Problem Book Sync

## 1. Goal

Implement a 101 Weiqi integration that logs in to the user's own 101 Weiqi account, visits the wrong-problem book page, discovers every listed problem, decodes each problem page, and stores the problems locally for Sabaki training workflows.

The core loop:

1. User opens the `101围棋` page in the Management Hub.
2. User logs in or reuses an existing authenticated session.
3. User clicks `同步错题本`.
4. Sabaki fetches `https://www.101weiqi.com/error/`.
5. Sabaki parses every wrong-problem card.
6. Sabaki visits each problem page and decodes the board/problem payload.
7. Sabaki stores the decoded problems and thumbnails in a local cache.

## 2. Scope

### V1

- Log in to 101 Weiqi with username/password and CSRF token handling.
- Keep an authenticated cookie session for subsequent sync requests.
- Fetch the authenticated user's wrong-problem book from `/error/`.
- Parse problem cards matching `.col-md-2.col-xs-6.col-sm-3`.
- Extract problem id, problem code, rank, thumbnail URL, and correctness stats.
- Visit each `/error/{problemId}/` page.
- Decode the encrypted problem payload from the problem page.
- Store decoded problems locally.
- Support incremental sync by skipping unchanged cached problems.
- Show sync progress, success count, failed count, and last sync time.

### Out of Scope for V1

- No batch submission of answers back to 101 Weiqi.
- No scraping of private pages beyond the authenticated user's own wrong-problem book.
- No CAPTCHA bypass or permission bypass.
- No full 101 Weiqi course/library mirror.
- No cloud sync of the local cache.
- No automatic background sync unless the user explicitly enables it later.

## 3. Frontend Contract Dependency

This feature should start from the shared Management Hub UI contract branch/worktree.

Before 101 Weiqi scraping and decoding work begins, the following frontend decisions should already be fixed:

- `OneOhOneWeiqiSettingsPane` component location and public props/events.
- Account/login status panel fields.
- Sync status fields.
- Progress, empty, failed-item, and retry states.
- Local cache controls.
- Bottom or panel-level primary action placement.

The 101 Weiqi feature worktree owns auth, scraping, decoding, cache, and training-data integration. It should avoid redesigning the Management Hub shell or changing shared sidebar behavior unless the shared UI contract is updated first.

## 4. User Scenarios

### Scenario 1: First-Time Login and Sync

The user opens `101围棋错题同步`, enters their account credentials, logs in, then clicks `同步错题本`. Sabaki fetches every wrong problem and stores them locally.

### Scenario 2: Re-Sync Existing Cache

The user already has a valid session. They click `同步错题本`, and Sabaki only downloads missing or changed problems.

### Scenario 3: Offline Training After Sync

After sync completes, the user can train against the locally cached wrong problems without opening 101 Weiqi.

### Scenario 4: Login Expired

If the cookie session expires, Sabaki shows `登录已失效` and asks the user to log in again.

## 5. Source Pages and Parsing

### 5.1 Login

Base URL:

```text
https://www.101weiqi.com/
```

Login action:

```text
https://www.101weiqi.com/login/
```

Login flow:

1. `GET /` to fetch the login page.
2. Extract `csrfmiddlewaretoken` from the login form.
3. `POST /login/` with form data:
   - `csrfmiddlewaretoken`
   - `source=index_nav`
   - `form_username`
   - `form_password`
   - optional `remember=on`
4. Preserve response cookies in a session cookie jar.
5. Confirm login by checking that authenticated-only pages are reachable.

Security requirements:

- Never write plaintext passwords to normal preferences.
- Prefer session cookies and OS-protected storage when persistence is needed.
- Redact credentials from logs, errors, telemetry, and test snapshots.

### 5.2 Wrong-Problem List

Wrong-problem book URL:

```text
https://www.101weiqi.com/error/
```

Each problem card is represented by a DOM element with all of these classes:

```css
.col-md-2.col-xs-6.col-sm-3
```

Example source shape:

```html
<div class="col-md-2 col-xs-6 col-sm-3">
  <div style="text-align:center;">
    <a href="/error/459697/">
      <img src="https://static4.101weiqi.com/file/qimg0/459697.png" style="max-width: 100%;">
    </a>
  </div>
  <div style="text-align:center;" class="warptext">
    Q-409082
    <span style="padding-left:8px;">4K</span>
  </div>
  <div style="text-align:center;" class="warptext">
    1052对/485错
  </div>
</div>
```

Extracted fields:

- `problemId`: from `/error/{problemId}/`, e.g. `459697`.
- `problemUrl`: absolute URL for the problem page.
- `thumbnailUrl`: image URL, e.g. `https://static4.101weiqi.com/file/qimg0/459697.png`.
- `problemCode`: visible code, e.g. `Q-409082`.
- `rank`: visible rank, e.g. `4K`.
- `correctCount`: from `1052对/485错`.
- `wrongCount`: from `1052对/485错`.

Pagination:

- V1 should discover and follow pagination links from the `/error/` page instead of hardcoding page URL patterns.
- Stop when there is no next page or when a seen page URL repeats.

## 6. Problem Page Decoding

After discovering a problem card, fetch:

```text
https://www.101weiqi.com/error/{problemId}/
```

The page contains an encrypted problem payload. The reference notebook shows two values are needed:

- `r`: numeric key seed from the page.
- `c`: base64-encoded encrypted problem content.

Recommended extraction:

- Extract `r` with a pattern equivalent to `"r":\s*([0-9]+)`.
- Extract `c` directly from the page data when available.
- As a fallback, extract the base64 string immediately before `"enable_answer"` if that is the stable shape in current pages.

Decode algorithm:

1. Parse `r` as an integer.
2. Compute `sequenceNumber = r + 1`.
3. Build key: `"101" + sequenceNumber + sequenceNumber + sequenceNumber`.
   - Example: if `r = 1`, key is `101222`.
4. Base64-decode `c` into bytes.
5. XOR each byte with the corresponding key character byte, cycling through the key.
6. Convert the result into the decoded problem text.
7. Parse the decoded text into Sabaki's local problem representation.

Pseudo-code:

```js
function decode101WeiqiPayload(encodedText, r) {
  let n = String(Number(r) + 1)
  let key = `101${n}${n}${n}`
  let bytes = base64Decode(encodedText)

  return bytes
    .map((byte, index) => byte ^ key.charCodeAt(index % key.length))
    .map(code => String.fromCharCode(code))
    .join('')
}
```

## 7. Local Data Model

Recommended cached problem shape:

```ts
type OneOhOneWeiqiProblem = {
  source: '101weiqi'
  problemId: string
  problemCode: string
  rank: string | null
  problemUrl: string
  thumbnailUrl: string | null
  correctCount: number | null
  wrongCount: number | null
  decodedPayload: string
  sgf?: string
  initialPosition?: unknown
  solutionTree?: unknown
  syncedAt: string
  contentHash: string
}
```

The parser should preserve the raw decoded payload until the final local exercise schema is confirmed. This makes future migrations possible if the decoded payload format varies across problem types.

## 8. Technical Architecture

### 8.1 Services

- `OneOhOneWeiqiAuthService`
  - Fetches CSRF token.
  - Posts login form.
  - Owns cookie/session validation.

- `OneOhOneWeiqiErrorBookService`
  - Fetches `/error/`.
  - Follows pagination.
  - Parses problem cards.

- `OneOhOneWeiqiProblemService`
  - Fetches individual problem pages.
  - Extracts `r` and `c`.
  - Calls the decoder.

- `OneOhOneWeiqiProblemDecoder`
  - Implements base64 + XOR decoding.
  - Converts decoded payloads into local problem records when possible.

- `TrainingProblemCache`
  - Stores synced problem metadata, thumbnails, decoded payloads, and parsed training data.

### 8.2 UI

Management Hub pane:

```text
src/components/management/OneOhOneWeiqiSettingsPane.js
```

Expected controls:

- Username
- Password or login prompt
- Login/logout
- Sync wrong-problem book
- Last sync time
- Synced problem count
- Failed item list or retry action
- Local cache clear action

## 9. Error Handling

- Invalid credentials: show a clear login failure message.
- Missing CSRF token: report that the login page shape changed.
- Unauthorized `/error/`: mark session expired and require login.
- Empty wrong-problem book: show a valid empty state.
- Problem card parse failure: skip card, log sanitized diagnostic metadata.
- Problem page decode failure: keep card metadata, mark problem as failed, allow retry.
- Network rate limiting/failure: back off and keep partial sync results.

## 10. Success Criteria

- User can log in to 101 Weiqi from the Management Hub.
- User can sync all visible wrong-problem-book entries from `/error/`.
- Sabaki extracts problem id, code, rank, thumbnail, and correctness stats from each card.
- Sabaki fetches each problem page and decodes the encrypted board/problem payload.
- Synced problems are available locally after network access is removed.
- Credentials are not stored or logged in plaintext.
