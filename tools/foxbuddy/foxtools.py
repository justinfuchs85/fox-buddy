#!/usr/bin/env python3
"""The fox's own tools: a tiny MCP server (stdio, standard library only) that Claude Code starts for
each of his chats. It can't change anything.

  find_files   finds files and folders BY NAME in the folders you allowed (--folder, repeatable) and
               returns their paths, sizes and dates. It never opens a file: whether he may read inside
               one is a separate switch in his chat, enforced by Claude Code itself.
  activity     reads the activity summary your iPhone Shortcut saves (--activity-dir, repeatable):
               steps, workouts and the like. Only the files in that folder.

Run by the app (tools/foxbuddy/main.swift) as:
  python3 foxtools.py --folder ~/Desktop --folder ~/Documents --activity-dir "~/Library/Mobile Documents/..."
"""
import fnmatch, json, os, re, shutil, subprocess, sys, time
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
    roots, dirs = [], []
    it = iter(argv)
    for a in it:
        if a == "--folder":
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
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            name, args = params.get("name"), params.get("arguments") or {}
            try:
                if name == "find_files":
                    text = find_files(args, roots) if roots else "The user hasn't allowed any folders."
                elif name == "activity":
                    text = activity(args, dirs)
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
