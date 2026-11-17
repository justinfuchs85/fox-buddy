#!/usr/bin/env python3
"""The fox's own tools: a tiny MCP server (stdio, standard library only) that Claude Code starts for
each of his chats. It can't change anything.

  find_files   finds files and folders BY NAME in the folders you allowed (--folder, repeatable) and
               returns their paths, sizes and dates. It never opens a file: whether he may read inside
               one is a separate switch in his chat, enforced by Claude Code itself.
  activity     reads the activity summary your iPhone Shortcut saves (--activity-dir, repeatable):
               steps, workouts and the like. Only the files in that folder.
  finances     looks things up in Fuchs Bucks (--fuchs-bucks-url), read-only: transactions, budgets,
               goals, accounts, net worth, debts, assets. Only when you've connected it
               (tools/foxbuddy/connect_fuchs_bucks.sh): the access token lives in your Keychain.

Run by the app (tools/foxbuddy/main.swift) as:
  python3 foxtools.py --folder ~/Desktop --folder ~/Documents --activity-dir "~/Library/Mobile Documents/..."
"""
import fnmatch, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime

MAX_SCAN = 300_000          # entries looked at per search, at most
MAX_SECONDS = 6.0
SKIP_DIRS = {"node_modules", "__pycache__", "Library", "venv", ".venv", "site-packages", "build", "DerivedData"}
# folders macOS shows as a single file: found as a whole, never searched inside
PACKAGES = (".app", ".photoslibrary", ".musiclibrary", ".tvlibrary", ".bundle", ".framework", ".xcodeproj",
            ".xcworkspace", ".pages", ".numbers", ".key", ".rtfd", ".band", ".logicx", ".imovielibrary", ".fcpbundle")
ACTIVITY_EXT = (".txt", ".csv", ".json", ".md", ".tsv")
MAX_ACTIVITY_BYTES = 20_000


def real(p):
    return os.path.realpath(os.path.expanduser(p))


def inside(path, roots):
    rp = real(path)
    return any(rp == r or rp.startswith(r + os.sep) for r in roots)


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def squash(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def matcher(query):
    """A test for a file name. "*.pdf" and "tax*" are globs; anything else is words that must all appear
    in the name, ignoring case and punctuation (so "w2 2025" finds "W-2_2025.pdf")."""
    q = (query or "").strip()
    if not q:
        return lambda name: True
    if any(c in q for c in "*?["):
        pats = [p.lower() for p in q.split()]
        return lambda name: all(fnmatch.fnmatch(name.lower(), p) for p in pats)
    words = [squash(w) for w in q.split() if squash(w)]
    return lambda name: all(w in squash(name) for w in words)


def walk(roots, test, limit, max_depth=12):
    """Breadth-first, newest results kept. Never follows symlinks, skips hidden files and app innards."""
    found, seen, start = [], 0, time.monotonic()
    queue = [(r, 0) for r in roots]
    while queue:
        d, depth = queue.pop(0)
        try:
            entries = list(os.scandir(d))
        except OSError:
            continue
        for e in entries:
            seen += 1
            if seen > MAX_SCAN or time.monotonic() - start > MAX_SECONDS:
                return found, True
            if e.name.startswith("."):
                continue
            try:
                is_dir = e.is_dir(follow_symlinks=False)
                st = e.stat(follow_symlinks=False)
            except OSError:
                continue
            package = is_dir and e.name.lower().endswith(PACKAGES)
            if test(e.name):
                found.append((e.path, st.st_size if not is_dir else None, st.st_mtime, is_dir and not package))
            if is_dir and not package and e.name not in SKIP_DIRS and depth < max_depth:
                queue.append((e.path, depth + 1))
    return found, False


def spotlight(roots, query):
    """Ask Spotlight (macOS) for names containing the first word, then filter like walk() would.
    None when Spotlight isn't there or has nothing, so the caller walks instead."""
    if not shutil.which("mdfind") or not query.strip() or any(c in query for c in "*?["):
        return None
    first = query.split()[0]
    test = matcher(query)
    found = []
    for r in roots:
        try:
            out = subprocess.run(["mdfind", "-onlyin", r, "-name", first], capture_output=True, text=True, timeout=5).stdout
        except Exception:
            return None
        for p in out.splitlines():
            name = os.path.basename(p)
            if not p or not inside(p, roots) or any(part.startswith(".") for part in p[len(r):].split(os.sep)):
                continue
            if not test(name):
                continue
            try:
                st = os.lstat(p)
            except OSError:
                continue
            is_dir = os.path.isdir(p) and not os.path.islink(p)
            found.append((p, None if is_dir else st.st_size, st.st_mtime, is_dir))
    return found or None


def find_files(args, roots):
    query = str(args.get("query") or "")[:200]
    limit = max(1, min(int(args.get("limit") or 25), 100))
    folder = str(args.get("folder") or "").strip()
    search = roots
    if folder:
        named = [r for r in roots if os.path.basename(r).lower() == folder.lower()]
        cand = named[0] if named else real(folder)
        if not inside(cand, roots) or not os.path.isdir(cand):
            return "That folder isn't one I'm allowed to look in. I can look in: " + ", ".join(roots)
        search = [cand]
    recent = not query.strip()
    hits = None if recent else spotlight(search, query)
    partial = False
    if hits is None:
        hits, partial = walk(search, matcher(query), limit, max_depth=3 if recent else 12)
    hits.sort(key=lambda h: h[2], reverse=True)
    total = len(hits)
    if not total:
        return f"No files or folders named like \"{query}\" in " + ", ".join(search) + "."
    lines = []
    for path, size, mtime, is_dir in hits[:limit]:
        when = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        kind = "folder" if is_dir else human(size) if size is not None else "package"
        lines.append(f"{path}{'/' if is_dir else ''}  ({kind}, modified {when})")
    head = (f"{total} found" if not recent else f"{total} most recently changed") + (f", newest {limit} shown" if total > limit else "")
    if partial:
        head += " (the search stopped early: these folders are big, so there may be more)"
    return head + ":\n" + "\n".join(lines)


def activity(args, dirs):
    files = []
    for d in dirs:
        try:
            for e in os.scandir(d):
                if e.is_file(follow_symlinks=False) and e.name.lower().endswith(ACTIVITY_EXT) and not e.name.startswith("."):
                    files.append((e.stat().st_mtime, e.path))
        except OSError:
            continue
    if not files:
        return ("No activity summary yet. It comes from an iPhone Shortcut that saves one to iCloud Drive "
                "(see tools/foxbuddy/README.md, \"Activity updates\"). Looked in: " + ", ".join(dirs))
    files.sort(reverse=True)
    out, budget = [], MAX_ACTIVITY_BYTES
    for mtime, p in files[:3]:
        try:
            with open(p, "rb") as f:
                f.seek(0, 2); size = f.tell(); f.seek(max(0, size - budget))
                text = f.read().decode("utf-8", "replace")
        except OSError:
            continue
        when = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        out.append(f"--- {os.path.basename(p)} (updated {when}) ---\n{text.strip()}")
        budget -= len(text)
        if budget <= 0:
            break
    return "\n\n".join(out)


KEYCHAIN_SERVICE = "Fox Buddy: Fuchs Bucks"
FINANCE_LOOKUPS = ["get_transactions", "get_budgets", "get_savings_goals", "get_accounts",
                   "get_net_worth_snapshots", "get_debts", "get_assets_and_liabilities"]
MAX_FINANCE_BYTES = 40_000


def fuchs_bucks_token():
    t = os.environ.get("FOX_FUCHS_BUCKS_TOKEN")             # (for tests)
    if t:
        return t.strip()
    if not shutil.which("security"):
        return None
    try:
        out = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
                             capture_output=True, text=True, timeout=10)
    except Exception:
        return None
    return out.stdout.strip() or None


def finances(args, base):
    lookup = str(args.get("lookup") or "")
    if lookup not in FINANCE_LOOKUPS:
        return "Pick a lookup: " + ", ".join(FINANCE_LOOKUPS)
    filters = args.get("filters") if isinstance(args.get("filters"), dict) else {}
    token = fuchs_bucks_token()
    if not token:
        return "Fuchs Bucks isn't connected on this Mac (no access token in the Keychain). Run tools/foxbuddy/connect_fuchs_bucks.sh."
    data = json.dumps({"tool": lookup, "input": filters}).encode()
    url = base + "/api/fox"
    try:
        for _ in range(3):
            req = urllib.request.Request(url, method="POST", data=data,
                                         headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            try:
                with NO_REDIRECTS.open(req, timeout=25) as r:
                    body = r.read(MAX_FINANCE_BYTES * 4).decode("utf-8", "replace")
                break
            except urllib.error.HTTPError as e:
                # fuchsbucks.com -> www.fuchsbucks.com and the like: follow it, but only to the same site over https,
                # so the token is never sent anywhere else
                nxt = same_site_redirect(url, e) if e.code in (301, 302, 303, 307, 308) else None
                if not nxt:
                    raise
                url = nxt
        else:
            return "Fuchs Bucks kept redirecting. Check fuchs_bucks_url in ~/.desk-buddy/config.json."
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return f"Fuchs Bucks redirected the lookup somewhere else ({e.headers.get('Location')}), so I didn't follow it. Set fuchs_bucks_url in ~/.desk-buddy/config.json to that site's address."
        if e.code in (401, 404):
            return f"Fuchs Bucks refused the lookup ({e.code}): the access token or its settings on the server don't match. Run tools/foxbuddy/connect_fuchs_bucks.sh again."
        return f"Fuchs Bucks had a problem ({e.code})."
    except Exception as e:
        return f"Couldn't reach Fuchs Bucks: {e}"
    try:
        data = json.loads(body)
    except ValueError:
        return "Fuchs Bucks sent back something unexpected."
    if "error" in data:
        return "Fuchs Bucks: " + str(data["error"])
    text = json.dumps(data.get("result"), separators=(",", ":"))
    if len(text) > MAX_FINANCE_BYTES:
        text = text[:MAX_FINANCE_BYTES] + " …(cut short: narrow the dates or filters)"
    return text


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None                                          # surface every redirect as an HTTPError; finances() decides


NO_REDIRECTS = urllib.request.build_opener(_NoRedirect)


def same_site_redirect(url, err):
    """The redirect's target, if it's https on the same site (example.com <-> www.example.com), else None."""
    loc = err.headers.get("Location") or ""
    target = urllib.parse.urlsplit(urllib.parse.urljoin(url, loc))
    here = urllib.parse.urlsplit(url)
    bare = lambda h: (h or "").lower().removeprefix("www.") if hasattr(str, "removeprefix") else re.sub(r"^www\.", "", (h or "").lower())
    if target.scheme == "https" and bare(target.hostname) == bare(here.hostname) and target.port == here.port:
        return urllib.parse.urlunsplit((target.scheme, target.netloc, target.path or "/api/fox", target.query, ""))
    return None


FINANCES_TOOL = {
    "name": "finances",
    "description": "Look up the user's own finances in their Fuchs Bucks ledger (read-only, amounts in USD). "
                   "lookup is one of: get_transactions (filters: startDate, endDate as YYYY-MM-DD; categoryName (exact); "
                   "descriptionContains; minAmount, maxAmount (expenses are negative); limit, default 200, max 500), "
                   "get_budgets, get_savings_goals, get_accounts (balances), get_net_worth_snapshots (filters: limit), "
                   "get_debts, get_assets_and_liabilities. Scope transactions by date or category whenever the question allows. "
                   "Transactions marked excludeFromSpend (transfers and the like) don't count as spending.",
    "inputSchema": {"type": "object", "properties": {
        "lookup": {"type": "string", "enum": FINANCE_LOOKUPS},
        "filters": {"type": "object"}},
        "required": ["lookup"], "additionalProperties": False},
}

TOOLS = [
    {"name": "find_files",
     "description": "Find files and folders BY NAME in the folders the user allowed (it never reads inside files). "
                    "query: words that must all be in the name (case and punctuation ignored, e.g. \"w2 2025\"), "
                    "or a glob like \"*.pdf\". Leave query empty to list the most recently changed items. "
                    "folder: optional, one allowed folder (e.g. \"Downloads\") or a folder inside one. "
                    "Returns absolute paths, sizes and modified dates, newest first.",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "folder": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 100}},
         "additionalProperties": False}},
    {"name": "activity",
     "description": "Read the user's recent activity summary (steps, workouts, active calories and so on) that their "
                    "iPhone saves each day. Use it for questions about their exercise or activity.",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
]


def main(argv):
    roots, dirs, money = [], [], None
    it = iter(argv)
    for a in it:
        if a == "--fuchs-bucks-url":
            u = next(it, "").rstrip("/")
            if re.match(r"^https://[A-Za-z0-9.-]+(:\d+)?$", u) or re.match(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", u):
                money = u
        elif a == "--folder":
            p = real(next(it, ""))
            if os.path.isdir(p):
                roots.append(p)
        elif a == "--activity-dir":
            dirs.append(real(next(it, "")))
    out = sys.stdout

    def send(msg):
        out.write(json.dumps(msg) + "\n"); out.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
        if mid is None:
            continue                                   # notifications need no answer
        if method == "initialize":
            send({"jsonrpc": "2.0", "id": mid, "result": {
                "protocolVersion": params.get("protocolVersion") or "2025-06-18",
                "capabilities": {"tools": {}}, "serverInfo": {"name": "fox", "version": "1.0"}}})
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS + ([FINANCES_TOOL] if money else [])}})
        elif method == "tools/call":
            name, args = params.get("name"), params.get("arguments") or {}
            try:
                if name == "find_files":
                    text = find_files(args, roots) if roots else "The user hasn't allowed any folders."
                elif name == "activity":
                    text = activity(args, dirs)
                elif name == "finances" and money:
                    text = finances(args, money)
                else:
                    raise ValueError(f"no tool called {name}")
                send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}]}})
            except Exception as e:
                send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}})
        elif method == "ping":
            send({"jsonrpc": "2.0", "id": mid, "result": {}})
        else:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"unknown method {method}"}})


if __name__ == "__main__":
    main(sys.argv[1:])
