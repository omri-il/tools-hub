# Tool Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count how many times each tool on `tools.omri-iram.co.il` is used — separating Omri's own usage from visitors' — with a running total and a 90-day daily trend, viewable in an inline admin panel on the hub.

**Architecture:** A tool-card click on the hub fires a fire-and-forget `keepalive` `fetch` to the existing `go-shortener` Flask service. The service attributes the click to Omri (valid `X-Session` token present) or a visitor (no token), bumps two small SQLite tables, and exposes an authed `/api/stats` endpoint the hub's admin panel renders as a ranked table with SVG sparklines.

**Tech Stack:** Python 3 / Flask / SQLite (backend, go-shortener) · vanilla HTML/CSS/JS (frontend, tools-hub) · pytest (backend tests) · Playwright (frontend test).

## Global Constraints

- **No new backend dependencies.** Reuse Flask, `sqlite3`, and the standard library (`zoneinfo` is stdlib). Do not add packages to `requirements.txt`.
- **No new frontend dependencies.** No chart library — sparklines are hand-rolled inline SVG.
- **Analytics must never break the page.** Every tracking code path is wrapped so a failure (network, storage, etc.) is silent and navigation is unaffected.
- **"Me" vs "visitor" is decided server-side** by the presence of a valid `X-Session` token — never a client-supplied boolean.
- **Tool-id allowlist (exactly these 24 ids), identical in `index.html` `data-tool` attributes and `app.py` `TRACK_TOOLS`:** `video-search`, `chapter-bar`, `whisper`, `biomimicry`, `micropod`, `energy`, `email-generator`, `gmail-mass-reply`, `tinyurl`, `qr`, `qr-dynamic`, `utm`, `shortener`, `randomizer`, `time-tracker`, `plant-care`, `video-downloader`, `davinci-control`, `notebooklm`, `gems`, `extra`, `thanks-letter`, `geg-events`, `forms-mailerlite`.
- **Daily buckets trimmed to the last 90 days.**
- **Track endpoint returns `204` for everything** (success, unknown tool, rate-limited) so probing reveals nothing.
- **Counts only — no PII, no cookies, no third party.** Client IP is used transiently for rate-limiting and never stored.
- **Backend service:** systemd `go-shortener.service` on the VPS (`147.79.114.195`), port 8091, behind nginx at `https://go.omri-iram.co.il`. CORS already locked to `https://tools.omri-iram.co.il`.
- **Deploy backend by:** committing locally in `C:\Users\omrii\Projects\go-shortener`, pushing to `origin/master`, then `git pull` + `systemctl restart go-shortener` on the VPS. `links.db` is gitignored on both; the VPS tree is clean.

---

## File Structure

**Backend — `C:\Users\omrii\Projects\go-shortener\` (local clone; deploy to VPS):**
- Modify `app.py` — add two tables to `init_db()`, date/rate-limit helpers, `TRACK_TOOLS` allowlist, and two routes (`POST /api/track`, `GET /api/stats`). Single-file Flask app; follow its existing style.
- Create `test_stats.py` — pytest for the new endpoints, mirroring `test_auth.py`'s fixture.

**Frontend — `C:\Users\omrii\Projects\tools-hub\`:**
- Modify `index.html` — add `data-tool` to each `.tool-card`; add the tracking `<script>`; add the admin stats panel markup + render script.
- Modify `CLAUDE.md` — document the feature, the allowlist, and the "add a tool → add its id in both places" rule.
- Create `tests/analytics.spec.mjs` — Playwright test for the ping (fires once, debounced) and the admin panel render.

---

## Phase A — Backend (go-shortener)

### Task A0: Sync local clone and confirm test baseline

**Files:** none (environment prep).

- [ ] **Step 1: Pull latest and confirm clean tree**

Run:
```bash
cd /c/Users/omrii/Projects/go-shortener && git pull --ff-only origin master && git status --short
```
Expected: fast-forwards to the latest commit; `git status --short` prints nothing.

- [ ] **Step 2: Install test deps into the existing venv**

Run:
```bash
cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pip install -q -r requirements.txt pytest
```
Expected: completes without error (Flask, flask-cors, pyotp, Authlib, pytest present).

- [ ] **Step 3: Run the existing suite to confirm a green baseline**

Run:
```bash
cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest -q
```
Expected: existing `test_auth.py` tests PASS (baseline before any change).

---

### Task A1: Schema, helpers, and allowlist

**Files:**
- Modify: `app.py` (add tables to `init_db()`; add helpers + `TRACK_TOOLS` near the top-level constants)
- Test: `test_stats.py` (new)

**Interfaces:**
- Produces: `_today() -> str` (`'YYYY-MM-DD'`, Asia/Jerusalem), `_day_offset(days:int) -> str`, `TRACK_TOOLS: set[str]`, and two tables `tool_stats(tool_id, total, admin_total)` / `tool_stats_daily(tool_id, day, total, admin)`.

- [ ] **Step 1: Write the failing test**

Create `test_stats.py`:
```python
"""Tool-usage analytics tests: /api/track + /api/stats. Run: `pytest -q`."""
import importlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("TOTP_SECRET", "JBSWY3DPEHPK3PXP")
    monkeypatch.setenv("FLASK_SECRET", "test-flask-secret")
    monkeypatch.setenv("ADMIN_EMAIL", "hello@omri-iram.co.il")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "csecret")
    monkeypatch.setenv("BASE_URL", "https://go.omri-iram.co.il")
    import app as app_module
    importlib.reload(app_module)
    app_module.app.config["TESTING"] = True
    c = app_module.app.test_client()
    c.app_module = app_module
    return c


def _admin_headers(client):
    return {"X-Session": client.app_module._make_token()}


def test_helpers_and_allowlist(client):
    m = client.app_module
    assert len(m._today()) == 10 and m._today()[4] == "-"
    assert m._day_offset(-90) < m._today()
    assert "qr" in m.TRACK_TOOLS and "totally-made-up" not in m.TRACK_TOOLS
    assert len(m.TRACK_TOOLS) == 24


def test_tables_exist(client):
    # A track write (added in A2) will need these; here just confirm they exist.
    import sqlite3, os
    con = sqlite3.connect(os.environ["DB_PATH"])
    names = {r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    con.close()
    assert "tool_stats" in names and "tool_stats_daily" in names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest test_stats.py -q`
Expected: FAIL — `AttributeError: module 'app' has no attribute '_today'` (and table assertions fail).

- [ ] **Step 3: Add helpers + allowlist to `app.py`**

Near the top imports of `app.py`, after `import pyotp, hmac, hashlib, time`, add:
```python
from datetime import datetime, timedelta
try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("Asia/Jerusalem")
except Exception:
    _TZ = None


def _now():
    return datetime.now(_TZ) if _TZ else datetime.now()


def _today():
    return _now().strftime("%Y-%m-%d")


def _day_offset(days):
    return (_now() + timedelta(days=days)).strftime("%Y-%m-%d")
```

After the `RESERVED = {...}` line, add the allowlist:
```python
# Tool ids whose hub-card clicks we count. MUST stay in sync with the
# data-tool="..." attributes in tools-hub/index.html (see tools-hub CLAUDE.md).
TRACK_TOOLS = {
    "video-search", "chapter-bar", "whisper", "biomimicry", "micropod", "energy",
    "email-generator", "gmail-mass-reply", "tinyurl", "qr", "qr-dynamic", "utm",
    "shortener", "randomizer", "time-tracker", "plant-care", "video-downloader",
    "davinci-control", "notebooklm", "gems", "extra", "thanks-letter",
    "geg-events", "forms-mailerlite",
}
```

- [ ] **Step 4: Add the two tables to `init_db()`**

In `init_db()`, before `conn.commit()`, add:
```python
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tool_stats (
            tool_id      TEXT PRIMARY KEY,
            total        INTEGER NOT NULL DEFAULT 0,
            admin_total  INTEGER NOT NULL DEFAULT 0
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tool_stats_daily (
            tool_id  TEXT NOT NULL,
            day      TEXT NOT NULL,
            total    INTEGER NOT NULL DEFAULT 0,
            admin    INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (tool_id, day)
        )"""
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest test_stats.py -q`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd /c/Users/omrii/Projects/go-shortener && git add app.py test_stats.py && git commit -m "analytics: tool_stats tables + date helpers + tool allowlist"
```

---

### Task A2: `POST /api/track`

**Files:**
- Modify: `app.py` (add rate-limit state + `_client_ip()` + `_rate_ok()` + the route)
- Test: `test_stats.py` (add cases)

**Interfaces:**
- Consumes: `TRACK_TOOLS`, `_today()`, `authed()` (existing — returns True when a valid `X-Session` is present), `get_db()`.
- Produces: route `POST /api/track` body `{tool}` → `204`; module-level `_track_hits: dict`, `_TRACK_LIMIT: int`, `_rate_ok(ip)`.

- [ ] **Step 1: Write the failing tests**

Append to `test_stats.py`:
```python
def test_track_unknown_tool_ignored(client):
    assert client.post("/api/track", json={"tool": "totally-made-up"}).status_code == 204
    r = client.get("/api/stats", headers=_admin_headers(client))
    assert r.get_json()["tools"] == []


def test_track_visitor_counts_as_visitor(client):
    assert client.post("/api/track", json={"tool": "qr"}).status_code == 204
    tools = {t["tool"]: t for t in
             client.get("/api/stats", headers=_admin_headers(client)).get_json()["tools"]}
    assert tools["qr"]["total"] == 1
    assert tools["qr"]["me"] == 0
    assert tools["qr"]["visitors"] == 1


def test_track_admin_counts_as_me(client):
    client.post("/api/track", json={"tool": "qr"}, headers=_admin_headers(client))
    qr = next(t for t in
              client.get("/api/stats", headers=_admin_headers(client)).get_json()["tools"]
              if t["tool"] == "qr")
    assert qr["me"] == 1 and qr["total"] == 1 and qr["visitors"] == 0


def test_track_records_today_bucket(client):
    client.post("/api/track", json={"tool": "randomizer"})
    rz = next(t for t in
              client.get("/api/stats", headers=_admin_headers(client)).get_json()["tools"]
              if t["tool"] == "randomizer")
    assert rz["daily"] and rz["daily"][-1]["day"] == client.app_module._today()
    assert rz["daily"][-1]["total"] == 1


def test_track_rate_limit_drops_excess(client, monkeypatch):
    monkeypatch.setattr(client.app_module, "_TRACK_LIMIT", 2)
    client.app_module._track_hits.clear()
    for _ in range(5):
        client.post("/api/track", json={"tool": "qr"})
    qr = next(t for t in
              client.get("/api/stats", headers=_admin_headers(client)).get_json()["tools"]
              if t["tool"] == "qr")
    assert qr["total"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest test_stats.py -q`
Expected: FAIL — `/api/track` returns 404 (route not defined) / `/api/stats` 404.

- [ ] **Step 3: Add rate-limit helpers to `app.py`**

After the `TRACK_TOOLS = {...}` block, add:
```python
# Best-effort in-memory per-IP rate limit for the open /api/track endpoint.
# Per-process (fine — go-shortener runs a single worker); purely an abuse guard.
_track_hits = {}     # ip -> (window_start_epoch, count)
_TRACK_LIMIT = 60    # max /api/track per window
_TRACK_WINDOW = 60   # seconds


def _client_ip():
    xff = request.headers.get("X-Forwarded-For", "")
    return (xff.split(",")[0].strip() if xff else request.remote_addr) or ""


def _rate_ok(ip):
    now = time.time()
    ws, cnt = _track_hits.get(ip, (now, 0))
    if now - ws >= _TRACK_WINDOW:
        ws, cnt = now, 0
    cnt += 1
    _track_hits[ip] = (ws, cnt)
    return cnt <= _TRACK_LIMIT
```

- [ ] **Step 4: Add the `/api/track` route**

Add after the `api_health()` route in `app.py`:
```python
@app.route("/api/track", methods=["POST"])
def api_track():
    """Count a tool-card click. Public (CORS-locked). Attributes to Omri iff a
    valid X-Session is present, else to visitors. Always 204 (probing reveals
    nothing)."""
    if not _rate_ok(_client_ip()):
        return ("", 204)
    data = request.get_json(silent=True) or {}
    tool = (data.get("tool") or "").strip()
    if tool not in TRACK_TOOLS:
        return ("", 204)
    a = 1 if authed() else 0
    day = _today()
    db = get_db()
    db.execute(
        "INSERT INTO tool_stats (tool_id, total, admin_total) VALUES (?, 1, ?) "
        "ON CONFLICT(tool_id) DO UPDATE SET total = total + 1, admin_total = admin_total + ?",
        (tool, a, a),
    )
    db.execute(
        "INSERT INTO tool_stats_daily (tool_id, day, total, admin) VALUES (?, ?, 1, ?) "
        "ON CONFLICT(tool_id, day) DO UPDATE SET total = total + 1, admin = admin + ?",
        (tool, day, a, a),
    )
    db.commit()
    return ("", 204)
```

*(These tests also exercise `/api/stats`, added in Task A3. Run order below builds A3 next; if running A2 in isolation, expect the `/api/stats`-dependent assertions to remain red until A3.)*

- [ ] **Step 5: Commit**

```bash
cd /c/Users/omrii/Projects/go-shortener && git add app.py test_stats.py && git commit -m "analytics: POST /api/track (server-side me/visitor attribution + rate limit)"
```

---

### Task A3: `GET /api/stats`

**Files:**
- Modify: `app.py` (add the route)
- Test: `test_stats.py` (add auth + trim cases)

**Interfaces:**
- Consumes: `authed()`, `get_db()`, `_day_offset()`.
- Produces: route `GET /api/stats` → `{"tools":[{tool,total,me,visitors,daily:[{day,total,admin}]}]}`, sorted by `total` desc, `daily` limited to the last 90 days; `401` when unauthed.

- [ ] **Step 1: Write the failing tests**

Append to `test_stats.py`:
```python
def test_stats_requires_auth(client):
    assert client.get("/api/stats").status_code == 401


def test_stats_trims_old_daily_rows(client):
    import os, sqlite3
    client.post("/api/track", json={"tool": "qr"})              # today's row
    con = sqlite3.connect(os.environ["DB_PATH"])
    con.execute("INSERT INTO tool_stats_daily (tool_id, day, total, admin) "
                "VALUES ('qr', '2000-01-01', 5, 0)")            # ancient row
    con.commit(); con.close()
    qr = next(t for t in
              client.get("/api/stats", headers=_admin_headers(client)).get_json()["tools"]
              if t["tool"] == "qr")
    days = [d["day"] for d in qr["daily"]]
    assert "2000-01-01" not in days          # trimmed from the response
    assert client.app_module._today() in days
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest test_stats.py -q`
Expected: FAIL — `/api/stats` returns 404 (route not yet defined).

- [ ] **Step 3: Add the `/api/stats` route**

Add after the `api_track()` route in `app.py`:
```python
@app.route("/api/stats")
def api_stats():
    """Per-tool usage for the admin panel. Authed (X-Session, hello@ only)."""
    if not authed():
        return jsonify(error="unauthorized"), 401
    db = get_db()
    cutoff = _day_offset(-90)
    db.execute("DELETE FROM tool_stats_daily WHERE day < ?", (cutoff,))
    db.commit()
    totals = db.execute(
        "SELECT tool_id, total, admin_total FROM tool_stats").fetchall()
    daily = db.execute(
        "SELECT tool_id, day, total, admin FROM tool_stats_daily "
        "WHERE day >= ? ORDER BY day ASC", (cutoff,)).fetchall()
    by_tool = {}
    for r in daily:
        by_tool.setdefault(r["tool_id"], []).append(
            {"day": r["day"], "total": r["total"], "admin": r["admin"]})
    out = [{
        "tool": r["tool_id"],
        "total": r["total"],
        "me": r["admin_total"],
        "visitors": r["total"] - r["admin_total"],
        "daily": by_tool.get(r["tool_id"], []),
    } for r in totals]
    out.sort(key=lambda t: t["total"], reverse=True)
    return jsonify(tools=out)
```

- [ ] **Step 4: Run the full backend suite to verify it passes**

Run: `cd /c/Users/omrii/Projects/go-shortener && ./venv/Scripts/python -m pytest -q`
Expected: PASS — all `test_auth.py` and `test_stats.py` tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/omrii/Projects/go-shortener && git add app.py test_stats.py && git commit -m "analytics: GET /api/stats (ranked totals + 90-day daily, trims old rows)"
```

---

### Task A4: Deploy to VPS and verify live

**Files:** none (deploy).

- [ ] **Step 1: Push to origin**

Run:
```bash
cd /c/Users/omrii/Projects/go-shortener && git push origin master
```
Expected: push succeeds.

- [ ] **Step 2: Pull + restart on the VPS**

Run:
```bash
ssh root@147.79.114.195 'cd /root/Projects/go-shortener && git pull --ff-only origin master && systemctl restart go-shortener && sleep 2 && systemctl is-active go-shortener'
```
Expected: fast-forward pull, then prints `active`.

- [ ] **Step 3: Smoke-test live endpoints**

Run:
```bash
ssh root@147.79.114.195 'curl -s -o /dev/null -w "track=%{http_code}\n" -X POST https://go.omri-iram.co.il/api/track -H "Content-Type: application/json" -d "{\"tool\":\"qr\"}" ; curl -s -o /dev/null -w "stats_noauth=%{http_code}\n" https://go.omri-iram.co.il/api/stats'
```
Expected: `track=204` and `stats_noauth=401`.

- [ ] **Step 4: Confirm the count landed (authed stats via a minted token)**

Run:
```bash
ssh root@147.79.114.195 'cd /root/Projects/go-shortener && TOK=$(venv/bin/python -c "import os; os.environ.setdefault(\"TOTP_SECRET\", open(\".env\").read()); import re,app; print(app._make_token())" 2>/dev/null); curl -s https://go.omri-iram.co.il/api/stats -H "X-Session: $TOK" | head -c 400'
```
Expected: JSON containing `"tool":"qr"` with `total >= 1`. (If the inline token mint is awkward, instead verify by opening the hub in a browser after Phase B — the panel is the real acceptance test. This step is a best-effort backend confirmation.)

---

## Phase B — Frontend (tools-hub)

### Task B1: Add `data-tool` ids to every card

**Files:**
- Modify: `index.html` (add `data-tool="<id>"` to each `<a class="tool-card ...">`)

**Interfaces:**
- Produces: each tracked card carries `data-tool` with an id from the allowlist. Mapping (by `href`): `video-search/`→`video-search`; `chapter-bar-web`→`chapter-bar`; `147.79.114.195:8080`→`whisper`; `biomimicry.omri-iram.co.il`→`biomimicry`; `micropod.omri-iram.co.il`→`micropod`; `energy.omri-iram.co.il`→`energy`; `email-generator/`→`email-generator`; the Gmail `script.google.com` card→`gmail-mass-reply`; `tinyurl/`→`tinyurl`; `qr/`→`qr`; `qr-dynamic/`→`qr-dynamic`; `utm/`→`utm`; `shortener/`→`shortener`; `randomizer/`→`randomizer`; `time.omri-iram.co.il`→`time-tracker`; `plants.omri-iram.co.il`→`plant-care`; `:5112/`→`video-downloader`; `:5007/`→`davinci-control`; `:5111/`→`notebooklm`; `:5012/`→`gems`; `extra/`→`extra`; `thanks.omri-iram.co.il`→`thanks-letter`; `geg.omri-iram.co.il`→`geg-events`; `forms.omri-iram.co.il`→`forms-mailerlite`.

- [ ] **Step 1: Add the attribute to each card**

For every `<a class="tool-card ...">` opening tag, insert `data-tool="<id>"` per the mapping above. Example — the first card becomes:
```html
        <a class="tool-card" href="video-search/" rel="noopener" data-tool="video-search">
```
and an admin card:
```html
        <a class="tool-card admin-only" href="http://147.79.114.195:8080" target="_blank" rel="noopener" data-tool="whisper">
```
Do this for all 24 cards.

- [ ] **Step 2: Verify all 24 cards are tagged**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && grep -c 'class="tool-card' index.html && grep -c 'data-tool=' index.html
```
Expected: both numbers equal `24`.

- [ ] **Step 3: Verify every id is in the allowlist (no typos)**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && grep -oE 'data-tool="[^"]+"' index.html | sed 's/data-tool="//;s/"//' | sort > /tmp/ids.txt && printf '%s\n' biomimicry chapter-bar davinci-control email-generator energy extra forms-mailerlite geg-events gems gmail-mass-reply micropod notebooklm plant-care qr qr-dynamic randomizer shortener thanks-letter time-tracker tinyurl utm video-downloader video-search whisper | sort > /tmp/allow.txt && diff /tmp/ids.txt /tmp/allow.txt && echo "IDS MATCH ALLOWLIST"
```
Expected: prints `IDS MATCH ALLOWLIST` with no diff output.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/omrii/Projects/tools-hub && git add index.html && git commit -m "analytics: add data-tool ids to all tool cards"
```

---

### Task B2: Click-tracking ping script

**Files:**
- Modify: `index.html` (add a `<script>` before the existing admin-unlock `<script>` at ~line 267)

**Interfaces:**
- Consumes: `.tool-card[data-tool]` elements; `localStorage['omri_session']` (optional).
- Produces: on each card click, at most one `POST https://go.omri-iram.co.il/api/track` per tool per 5s.

- [ ] **Step 1: Add the tracking script**

Immediately before the `<script>` that begins `// Hidden admin unlock` (~line 267), insert:
```html
  <script>
    // Usage analytics: on a tool-card click, fire a fire-and-forget ping to
    // go-shortener. The optional omri_session token attributes the click to
    // Omri server-side (never a client flag). 5s per-tool debounce. Must never
    // break the page — every path is guarded.
    (function () {
      var TRACK_URL = 'https://go.omri-iram.co.il/api/track';
      var DEBOUNCE_MS = 5000;
      function track(toolId) {
        try {
          var key = 'tt_last_' + toolId, now = Date.now(), last = 0;
          try { last = Number(localStorage.getItem(key) || 0); } catch (_) {}
          if (now - last < DEBOUNCE_MS) return;
          try { localStorage.setItem(key, String(now)); } catch (_) {}
          var session = '';
          try { session = localStorage.getItem('omri_session') || ''; } catch (_) {}
          var headers = { 'Content-Type': 'application/json' };
          if (session) headers['X-Session'] = session;
          fetch(TRACK_URL, {
            method: 'POST', keepalive: true, headers: headers,
            body: JSON.stringify({ tool: toolId })
          }).catch(function () {});
        } catch (_) { /* analytics must never break the page */ }
      }
      var cards = document.querySelectorAll('.tool-card[data-tool]');
      for (var i = 0; i < cards.length; i++) {
        (function (card) {
          card.addEventListener('click', function () { track(card.getAttribute('data-tool')); });
        })(cards[i]);
      }
    })();
  </script>
```

- [ ] **Step 2: Sanity-check the page still parses (no console errors)**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && node -e "const s=require('fs').readFileSync('index.html','utf8'); const o=(s.match(/<script>/g)||[]).length, c=(s.match(/<\/script>/g)||[]).length; if(o!==c) throw new Error('script tag mismatch '+o+'/'+c); console.log('script tags balanced:', o);"
```
Expected: prints a balanced count (no throw).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/omrii/Projects/tools-hub && git add index.html && git commit -m "analytics: fire-and-forget click ping with 5s per-tool debounce"
```

---

### Task B3: Admin stats panel (markup + render)

**Files:**
- Modify: `index.html` (add a hidden panel at the top of `<main>`, ~after line 53; add a render `<script>`; add minimal CSS in the existing `<style>`)

**Interfaces:**
- Consumes: `GET https://go.omri-iram.co.il/api/stats` with `X-Session`; `.tool-title` text per `data-tool` for Hebrew names; `body.admin` visibility.
- Produces: a `#statsPanel.cat-section.admin-only` rendering a ranked table + SVG sparklines.

- [ ] **Step 1: Add the panel markup**

Right after `<main aria-label="כלים">` (line 53), insert:
```html
    <section id="statsPanel" class="cat-section admin-only" aria-label="סטטיסטיקה">
      <h2 class="cat">📊 סטטיסטיקה — שימוש בכלים</h2>
      <div id="statsBody"><p class="stats-msg">טוען…</p></div>
    </section>
```

- [ ] **Step 2: Add panel CSS**

Before the closing `</style>` (line 39), add:
```css
    #statsPanel .stats-msg { opacity: .7; font-family: 'Heebo', sans-serif; }
    .stats-table { width: 100%; border-collapse: collapse; font-family: 'Heebo', sans-serif; }
    .stats-table th, .stats-table td { text-align: right; padding: 9px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08); font-size: .92rem; white-space: nowrap; }
    .stats-table th { opacity: .7; font-weight: 600; font-size: .82rem; }
    .stats-table td.num { font-variant-numeric: tabular-nums; }
    .stats-table .spark { stroke: #a78bfa; fill: none; stroke-width: 1.5; }
    .stats-table tbody tr:hover { background: rgba(255,255,255,0.03); }
```

- [ ] **Step 3: Add the render script**

Immediately after the tracking `<script>` from Task B2 (and before the admin-unlock script), insert:
```html
  <script>
    // Admin-only: render the usage table from /api/stats. Runs only when admin
    // mode is on. Hand-rolled SVG sparkline (last 30 days), no chart library.
    (function () {
      var STATS_URL = 'https://go.omri-iram.co.il/api/stats';
      function isAdmin() { try { return localStorage.getItem('omri_admin') === '1'; } catch (_) { return false; } }
      if (!isAdmin()) return;

      // id -> Hebrew name, read from the cards so it stays in sync.
      var names = {};
      var cards = document.querySelectorAll('.tool-card[data-tool]');
      for (var i = 0; i < cards.length; i++) {
        var t = cards[i].querySelector('.tool-title');
        names[cards[i].getAttribute('data-tool')] = t ? t.textContent.trim() : cards[i].getAttribute('data-tool');
      }
      function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

      function sparkline(daily) {
        var pts = (daily || []).slice(-30).map(function (d) { return d.total; });
        if (pts.length < 2) return '';
        var w = 90, h = 22, max = Math.max.apply(null, pts) || 1;
        var step = w / (pts.length - 1);
        var d = pts.map(function (v, i) {
          var x = (i * step).toFixed(1);
          var y = (h - 2 - (v / max) * (h - 4)).toFixed(1);
          return (i ? 'L' : 'M') + x + ' ' + y;
        }).join(' ');
        return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
               '" aria-hidden="true"><path class="spark" d="' + d + '"/></svg>';
      }

      function render(tools) {
        var body = document.getElementById('statsBody');
        if (!tools || !tools.length) { body.innerHTML = '<p class="stats-msg">אין עדיין נתונים.</p>'; return; }
        var rows = tools.map(function (t) {
          return '<tr><td>' + esc(names[t.tool] || t.tool) + '</td>' +
            '<td class="num">' + t.total + '</td>' +
            '<td class="num">' + t.me + '</td>' +
            '<td class="num">' + t.visitors + '</td>' +
            '<td>' + sparkline(t.daily) + '</td></tr>';
        }).join('');
        body.innerHTML = '<table class="stats-table"><thead><tr>' +
          '<th>כלי</th><th>סה״כ</th><th>שלי</th><th>מבקרים</th><th>מגמה (30 ימים)</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>';
      }

      var session = '';
      try { session = localStorage.getItem('omri_session') || ''; } catch (_) {}
      var headers = {};
      if (session) headers['X-Session'] = session;
      fetch(STATS_URL, { headers: headers })
        .then(function (r) {
          if (r.status === 401) { throw new Error('unauth'); }
          return r.json();
        })
        .then(function (j) { render(j.tools); })
        .catch(function (e) {
          var body = document.getElementById('statsBody');
          body.innerHTML = '<p class="stats-msg">' +
            (e && e.message === 'unauth'
              ? 'צריך להתחבר עם Google כדי לראות סטטיסטיקה.'
              : 'לא ניתן לטעון סטטיסטיקה כרגע.') + '</p>';
        });
    })();
  </script>
```

- [ ] **Step 4: Verify script tags still balanced**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && node -e "const s=require('fs').readFileSync('index.html','utf8'); const o=(s.match(/<script>/g)||[]).length, c=(s.match(/<\/script>/g)||[]).length; if(o!==c) throw new Error('mismatch'); console.log('ok', o);"
```
Expected: prints `ok 3` (tracking + stats + admin-unlock).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/omrii/Projects/tools-hub && git add index.html && git commit -m "analytics: admin-only stats panel (ranked table + SVG sparklines)"
```

---

### Task B4: Frontend test (Playwright)

**Files:**
- Create: `tests/analytics.spec.mjs`
- Modify: none of the app files.

**Interfaces:**
- Consumes: `index.html` served locally; routes `**/api/track` and `**/api/stats` intercepted.
- Produces: an automated check that the ping fires once + debounces, and the admin panel renders from a mocked stats payload.

> Use the **webapp-testing** skill for Playwright setup conventions. Serve the static site with `python -m http.server 8099` from the repo root during the test run.

- [ ] **Step 1: Ensure Playwright is available**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && npx --yes playwright@latest install chromium >/dev/null 2>&1 && echo "playwright ready"
```
Expected: prints `playwright ready`.

- [ ] **Step 2: Write the test**

Create `tests/analytics.spec.mjs`:
```javascript
import { test, expect, chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:8099';

test('card click pings track once, debounced within 5s', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hits = [];
  await page.route('**/go.omri-iram.co.il/api/track', async (route) => {
    hits.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto(BASE + '/index.html');
  const qr = page.locator('.tool-card[data-tool="qr"]');
  // Prevent real navigation so we can click twice on the same page.
  await page.evaluate(() => document.querySelectorAll('.tool-card').forEach(
    (a) => a.addEventListener('click', (e) => e.preventDefault())));
  await qr.click();
  await qr.click(); // within 5s → debounced
  await page.waitForTimeout(300);
  expect(hits.length).toBe(1);
  expect(hits[0].tool).toBe('qr');
  await browser.close();
});

test('admin panel renders ranked rows from mocked /api/stats', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/go.omri-iram.co.il/api/stats', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      tools: [
        { tool: 'qr', total: 42, me: 5, visitors: 37, daily: [
          { day: '2026-07-13', total: 3, admin: 1 },
          { day: '2026-07-14', total: 8, admin: 0 },
          { day: '2026-07-15', total: 5, admin: 2 } ] },
        { tool: 'randomizer', total: 9, me: 9, visitors: 0, daily: [] },
      ],
    }) });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('omri_admin', '1'); } catch (_) {}
  });
  await page.goto(BASE + '/index.html');
  const table = page.locator('#statsPanel .stats-table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  // First row is the top tool (qr) with its Hebrew name + totals.
  const first = table.locator('tbody tr').first();
  await expect(first).toContainText('42');
  await expect(first.locator('svg.spark, svg .spark')).toHaveCount(1);
  await browser.close();
});
```

- [ ] **Step 3: Run the test against a locally-served copy**

Run (starts a static server, runs the specs, stops the server):
```bash
cd /c/Users/omrii/Projects/tools-hub && (python -m http.server 8099 >/dev/null 2>&1 &) && sleep 1 && npx --yes playwright test tests/analytics.spec.mjs --reporter=line ; kill %1 2>/dev/null || true
```
Expected: `2 passed`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/omrii/Projects/tools-hub && git add tests/analytics.spec.mjs && git commit -m "analytics: Playwright test for ping debounce + admin panel render"
```

---

### Task B5: Document, deploy, and verify live

**Files:**
- Modify: `CLAUDE.md` (tools-hub) — document the analytics feature and the allowlist rule.

- [ ] **Step 1: Document the feature in tools-hub CLAUDE.md**

Add a new subsection under the tools list (before `## Deploy`):
```markdown
## Usage analytics (tool click counts)

Each `.tool-card` carries a `data-tool="<id>"`; a click fires a fire-and-forget
`keepalive` ping to **go-shortener** `POST /api/track {tool}`. Omri-vs-visitor is
decided **server-side** by the presence of a valid `omri_session` token (never a
client flag). go-shortener keeps per-tool lifetime totals + 90-day daily buckets
(`tool_stats` / `tool_stats_daily`) and serves them at authed `GET /api/stats`.
An **admin-only** `#statsPanel` on the hub renders a ranked table (total / mine /
visitors) with hand-rolled SVG sparklines. Counts only — no PII, no cookies, no
third party. Only clicks **from the hub page** are counted (direct bookmarks and
in-tool navigation are not).

**Adding a tool → add its id in BOTH places:** the `data-tool="…"` attribute in
`index.html` AND the `TRACK_TOOLS` set in go-shortener `app.py`. Ids not in the
set are silently ignored by the backend. Current ids: video-search, chapter-bar,
whisper, biomimicry, micropod, energy, email-generator, gmail-mass-reply,
tinyurl, qr, qr-dynamic, utm, shortener, randomizer, time-tracker, plant-care,
video-downloader, davinci-control, notebooklm, gems, extra, thanks-letter,
geg-events, forms-mailerlite.
```

- [ ] **Step 2: Commit the docs**

```bash
cd /c/Users/omrii/Projects/tools-hub && git add CLAUDE.md && git commit -m "docs: document tool usage analytics + allowlist sync rule"
```

- [ ] **Step 3: Push (GitHub Pages auto-deploys)**

Run:
```bash
cd /c/Users/omrii/Projects/tools-hub && git push origin master
```
Expected: push succeeds; GitHub Pages serves the new `index.html` within ~1 min.

- [ ] **Step 4: Verify live end-to-end (manual, in a browser)**

1. Open `https://tools.omri-iram.co.il`, click a couple of tool cards.
2. Return to the hub, triple-click the **OI** logo → enter PIN `9464` → admin mode.
3. Confirm the **📊 סטטיסטיקה** panel shows a ranked table with your clicks; your own clicks appear under **שלי** only if you're signed in with Google (`omri_session` present) — otherwise they count as visitors, which is expected.
4. (Optional) sign in with Google via any admin tool, click a card, refresh the hub → that click now appears under **שלי**.

Expected: the panel renders real counts; no console errors; tool navigation is unaffected throughout.

---

## Self-Review Notes

- **Spec coverage:** click tracking (B1–B2), server-side me/visitor attribution (A2), counts + daily trend data model (A1), 90-day trim (A3), rate-limit + no-PII (A2), inline admin panel with sparkline (B3), tests (A1–A3, B4), docs + allowlist-sync rule (B5), external-tool/direct-visit limitation documented (B5). All spec sections map to a task.
- **Placeholders:** none — every code and command step is concrete.
- **Type/name consistency:** `_today`/`_day_offset`/`TRACK_TOOLS`/`authed`/`_rate_ok`/`_track_hits`/`_TRACK_LIMIT` are defined in A1–A2 and used consistently; `/api/stats` JSON keys (`tool`,`total`,`me`,`visitors`,`daily[{day,total,admin}]`) are produced in A3 and consumed identically in the B3 render script and the B4 mock.
