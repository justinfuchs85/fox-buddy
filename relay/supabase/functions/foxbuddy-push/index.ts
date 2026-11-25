// Fox Buddy's push relay: the meeting point between the fox on a Mac and the Fox Buddy app on an iPhone.
//
// The Mac and the phone pair by QR code (the Mac makes a pair id, a secret and an encryption key; the phone gets
// all three from the code). The relay never sees the key: alert text arrives encrypted and only the phone's
// notification extension can read it. What the relay keeps per pair: a hash of the secret, the phone's push
// tokens, and nothing else. Live Activity updates are the exception to the encryption (iOS shows them without
// letting the app decrypt first), so the Mac keeps those to a short status: "Printing", "62%", a job name.
//
// One POST endpoint, JSON in and out:
//   {op:"hello",    pair, secret}                                   Mac, when pairing: claims the pair id
//   {op:"register", pair, secret, env, device?, start?, activity?}  phone: its push tokens
//   {op:"alert",    pair, secret, enc}                               Mac: an encrypted alert
//   {op:"activity", pair, secret, action, key, title, state, alert?} Mac: start / update / end a Live Activity
//   {op:"unpair",   pair, secret}                                   either: forget the pair
//
// Secrets (supabase secrets set ...): APNS_KEY_P8 (the .p8 file's text), APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC
// (the iPhone app's bundle id). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with --no-verify-jwt: callers prove themselves with the pair secret, not a Supabase login. Until the
// APNS_ secrets are set, every request gets a 503 saying which are missing.

type Row = {
  pair: string; secret_hash: string; env: string; device_token: string | null; start_token: string | null;
  activities: Record<string, string>; window_start: string; window_count: number;
};
export type Store = {
  get(pair: string): Promise<Row | null>;
  insert(row: Row): Promise<void>;
  update(pair: string, patch: Partial<Row>): Promise<void>;
  remove(pair: string): Promise<void>;
};
export type Push = (env: string, token: string, headers: Record<string, string>, body: unknown) => Promise<{ status: number; reason?: string }>;

const PAIR = /^[a-z0-9-]{16,64}$/, TOKEN = /^[0-9a-fA-F]{32,200}$/, KEY = /^[a-z0-9_-]{1,32}$/;
const LIMIT_PER_HOUR = 240;                 // pushes per pair per hour: a runaway Mac can't flood a phone
const MOODS = new Set(["printing", "working", "waiting", "done", "failed", "paused"]);

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function clip(v: unknown, n: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").slice(0, n) : "";
}

/** A Live Activity's content-state, cut down to what the iPhone app's FoxActivityAttributes.ContentState decodes. */
function contentState(s: Record<string, unknown> | undefined) {
  s = s || {};
  const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
  const out: Record<string, unknown> = {
    mood: MOODS.has(String(s.mood)) ? s.mood : "working",
    headline: clip(s.headline, 60), detail: clip(s.detail, 80),
  };
  const p = num(s.progress, 0, 1), since = num(s.since, 1.5e9, 4e9), ends = num(s.ends, 1.5e9, 4e9);
  if (p !== undefined) out.progress = p;
  if (since !== undefined) out.since = since;
  if (ends !== undefined) out.ends = ends;
  return out;
}

export function makeHandler(store: Store, push: Push, topic: string) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json(405, { error: "POST only" });
    let b: Record<string, any>;
    try { b = await req.json(); } catch { return json(400, { error: "not JSON" }); }
    if (!b || typeof b !== "object") return json(400, { error: "not JSON" });
    const pair = String(b.pair || ""), secret = String(b.secret || ""), op = String(b.op || "");
    if (!PAIR.test(pair) || secret.length < 20 || secret.length > 200) return json(400, { error: "bad pair or secret" });
    const hash = await sha256(secret);
    let row = await store.get(pair);
    if (op === "hello") {
      if (row && row.secret_hash !== hash) return json(403, { error: "that pair id is taken" });
      if (!row) {
        await store.insert({ pair, secret_hash: hash, env: "production", device_token: null, start_token: null, activities: {},
                             window_start: new Date().toISOString(), window_count: 0 });
      }
      return json(200, { ok: true, phone: !!row?.device_token });
    }
    if (!row || row.secret_hash !== hash) return json(403, { error: "not paired" });

    if (op === "unpair") { await store.remove(pair); return json(200, { ok: true }); }

    if (op === "register") {
      const patch: Partial<Row> = {};
      if (b.env === "sandbox" || b.env === "production") patch.env = b.env;
      if (typeof b.device === "string" && TOKEN.test(b.device)) patch.device_token = b.device;
      if (typeof b.start === "string" && TOKEN.test(b.start)) patch.start_token = b.start;
      if (b.activity && KEY.test(String(b.activity.key)) && typeof b.activity.token === "string" && TOKEN.test(b.activity.token)) {
        patch.activities = { ...row.activities, [b.activity.key]: b.activity.token };
      }
      if (b.activity && KEY.test(String(b.activity.key)) && b.activity.ended === true) {
        const a = { ...row.activities }; delete a[b.activity.key]; patch.activities = a;
      }
      await store.update(pair, patch);
      return json(200, { ok: true });
    }

    // Everything below sends a push: count it.
    const now = Date.now();
    let { window_start, window_count } = row;
    if (now - Date.parse(window_start) > 3600_000) { window_start = new Date(now).toISOString(); window_count = 0; }
    if (window_count >= LIMIT_PER_HOUR) return json(429, { error: "too many pushes this hour" });
    await store.update(pair, { window_start, window_count: window_count + 1 });

    if (op === "alert") {
      if (!row.device_token) return json(409, { error: "no phone yet" });
      const enc = clip(b.enc, 3000);
      if (!/^[A-Za-z0-9+/=_-]{40,}$/.test(enc)) return json(400, { error: "bad alert" });
      // What shows if the phone can't decrypt it (shouldn't happen): a generic line, never the content.
      const body = { aps: { alert: { title: "Fox Buddy", body: "Something new from your fox." }, "mutable-content": 1, sound: "default",
                            "thread-id": "fox" }, enc };
      const r = await push(row.env, row.device_token, { "apns-push-type": "alert", "apns-topic": topic, "apns-priority": "10" }, body);
      if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") await store.update(pair, { device_token: null });
      return json(r.status === 200 ? 200 : 502, { ok: r.status === 200, apns: r.reason });
    }

    if (op === "activity") {
      const key = String(b.key || ""), action = String(b.action || "");
      if (!KEY.test(key) || !["start", "update", "end"].includes(action)) return json(400, { error: "bad activity" });
      const ts = Math.floor(now / 1000), state = contentState(b.state);
      const token = row.activities[key];
      const headers = { "apns-push-type": "liveactivity", "apns-topic": topic + ".push-type.liveactivity" };
      let r: { status: number; reason?: string };
      if (action === "start" && !token) {
        if (!row.start_token) return json(409, { error: "no phone yet" });
        const aps: Record<string, unknown> = {
          timestamp: ts, event: "start", "content-state": state, "attributes-type": "FoxActivityAttributes",
          attributes: { key, title: clip(b.title, 40) || "Fox Buddy" }, "stale-date": ts + 4 * 3600,
          alert: { title: clip(b.alert?.title, 60) || clip(b.title, 40) || "Fox Buddy", body: clip(b.alert?.body, 120) || String(state.headline || "") },
        };
        r = await push(row.env, row.start_token, { ...headers, "apns-priority": "10" }, { aps });
        if (r.status === 410 || r.reason === "BadDeviceToken") await store.update(pair, { start_token: null });
      } else {
        if (!token) return json(409, { error: "that activity isn't showing" });
        const end = action === "end";
        const aps: Record<string, unknown> = { timestamp: ts, event: end ? "end" : "update", "content-state": state, "stale-date": ts + 4 * 3600 };
        if (end) aps["dismissal-date"] = ts + 30 * 60;                     // stays on the Lock Screen half an hour
        if (b.alert?.body) aps.alert = { title: clip(b.alert.title, 60) || "Fox Buddy", body: clip(b.alert.body, 120) };
        r = await push(row.env, token, { ...headers, "apns-priority": end || b.alert ? "10" : "5" }, { aps });
        if (end || r.status === 410 || r.reason === "BadDeviceToken") {
          const a = { ...row.activities }; delete a[key]; await store.update(pair, { activities: a });
        }
      }
      return json(r.status === 200 ? 200 : 502, { ok: r.status === 200, apns: r.reason });
    }
    return json(400, { error: "unknown op" });
  };
}

// ---------- the real thing: Postgres through PostgREST, and APNs over HTTP/2 ----------

export function restStore(url: string, key: string): Store {
  const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const base = `${url}/rest/v1/foxbuddy_pairs`;
  const ok = async (r: Response) => { if (!r.ok) throw new Error(`database ${r.status}`); return r; };
  return {
    async get(pair) {
      const r = await ok(await fetch(`${base}?pair=eq.${encodeURIComponent(pair)}&select=*`, { headers: h }));
      return ((await r.json()) as Row[])[0] || null;
    },
    async insert(row) { await ok(await fetch(base, { method: "POST", headers: h, body: JSON.stringify(row) })); },
    async update(pair, patch) {
      await ok(await fetch(`${base}?pair=eq.${encodeURIComponent(pair)}`, { method: "PATCH", headers: h,
        body: JSON.stringify({ ...patch, seen_at: new Date().toISOString() }) }));
    },
    async remove(pair) { await ok(await fetch(`${base}?pair=eq.${encodeURIComponent(pair)}`, { method: "DELETE", headers: h })); },
  };
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** APNs, signed with the team's .p8 key (a JWT, made again every 50 minutes). */
export function apns(p8: string, keyId: string, teamId: string): Push {
  let cached: { jwt: string; at: number } | null = null;
  let keyPromise: Promise<CryptoKey> | null = null;
  const signingKey = () => keyPromise ||= (async () => {
    const der = Uint8Array.from(atob(p8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  })();
  async function token() {
    const now = Math.floor(Date.now() / 1000);
    if (cached && now - cached.at < 3000) return cached.jwt;
    const input = b64url(JSON.stringify({ alg: "ES256", kid: keyId })) + "." + b64url(JSON.stringify({ iss: teamId, iat: now }));
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey(), new TextEncoder().encode(input));
    cached = { jwt: input + "." + b64url(sig), at: now };
    return cached.jwt;
  }
  return async (env, deviceToken, headers, body) => {
    const host = env === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const r = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST", headers: { authorization: `bearer ${await token()}`, ...headers }, body: JSON.stringify(body),
    });
    let reason: string | undefined;
    if (r.status !== 200) { try { reason = (await r.json()).reason; } catch { /* no body */ } }
    else await r.body?.cancel();
    return { status: r.status, reason };
  };
}

// Serve when running on Supabase (which sets SUPABASE_URL); importing this file for the tests serves nothing.
if (Deno.env.get("SUPABASE_URL")) {
  const NEEDS = ["SUPABASE_SERVICE_ROLE_KEY", "APNS_KEY_P8", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_TOPIC"];
  let handler: ((req: Request) => Promise<Response>) | null = null;
  Deno.serve(async (req) => {
    const missing = NEEDS.filter((k) => !Deno.env.get(k));
    if (missing.length) return json(503, { error: "the relay isn't set up yet: missing " + missing.join(", ") });
    const env = (k: string) => Deno.env.get(k)!;
    handler ||= makeHandler(restStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
                            apns(env("APNS_KEY_P8"), env("APNS_KEY_ID"), env("APNS_TEAM_ID")), env("APNS_TOPIC"));
    try { return await handler(req); } catch (e) {
      console.error("foxbuddy-push:", e instanceof Error ? e.message : e);
      return json(500, { error: "relay error" });
    }
  });
}
