// deno test --allow-env=SUPABASE_URL relay/supabase/functions/foxbuddy-push/index.test.ts
import { apns, makeHandler, sha256, type Push, type Store } from "./index.ts";

function assert(c: unknown, msg = "assertion failed"): asserts c { if (!c) throw new Error(msg); }
function eq(a: unknown, b: unknown) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${A} !== ${B}`); }

function memory() {
  const rows = new Map<string, any>();
  const store: Store = {
    get: async (p) => rows.has(p) ? structuredClone(rows.get(p)) : null,
    insert: async (r) => { rows.set(r.pair, structuredClone(r)); },
    update: async (p, patch) => { rows.set(p, { ...rows.get(p), ...structuredClone(patch) }); },
    remove: async (p) => { rows.delete(p); },
  };
  return { rows, store };
}

function setup(reply: (n: number) => { status: number; reason?: string } = () => ({ status: 200 })) {
  const m = memory(), sent: { env: string; token: string; headers: Record<string, string>; body: any }[] = [];
  const push: Push = async (env, token, headers, body) => { sent.push({ env, token, headers, body }); return reply(sent.length); };
  const h = makeHandler(m.store, push, "com.foxbuddy.phone");
  const call = async (b: unknown) => { const r = await h(new Request("http://x/", { method: "POST", body: JSON.stringify(b) })); return { status: r.status, body: await r.json() }; };
  return { ...m, sent, call };
}

const PAIR = "0f8fad5b-d9cb-469f-a165-70867728950e", SECRET = "s3cret-s3cret-s3cret-s3cret", DEV = "ab".repeat(32), START = "cd".repeat(32), ACT = "ef".repeat(32);

Deno.test("pairing: claim, re-claim, no stealing, secret never stored", async () => {
  const t = setup();
  eq((await t.call({ op: "hello", pair: PAIR, secret: SECRET })).status, 200);
  eq((await t.call({ op: "hello", pair: PAIR, secret: SECRET })).status, 200);
  eq((await t.call({ op: "hello", pair: PAIR, secret: "someone-else-entirely-x" })).status, 403);
  eq(t.rows.get(PAIR).secret_hash, await sha256(SECRET));
  assert(!JSON.stringify([...t.rows.values()]).includes(SECRET));
  eq((await t.call({ op: "register", pair: PAIR, secret: "wrong-wrong-wrong-wrong-x", device: DEV })).status, 403);
  eq((await t.call({ op: "alert", pair: "nope", secret: SECRET, enc: "x" })).status, 400);
});

Deno.test("alerts: only after the phone registers, encrypted text passed through, dead tokens dropped", async () => {
  const t = setup((n) => n === 2 ? { status: 410, reason: "Unregistered" } : { status: 200 });
  await t.call({ op: "hello", pair: PAIR, secret: SECRET });
  const enc = "A".repeat(60);
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc })).status, 409);
  eq((await t.call({ op: "register", pair: PAIR, secret: SECRET, env: "sandbox", device: DEV, start: START })).status, 200);
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc })).status, 200);
  const s = t.sent[0];
  eq([s.env, s.token, s.headers["apns-push-type"], s.headers["apns-topic"]], ["sandbox", DEV, "alert", "com.foxbuddy.phone"]);
  eq(s.body.enc, enc); eq(s.body.aps["mutable-content"], 1);
  assert(!JSON.stringify(s.body.aps).includes(enc), "the clear-text fallback never carries the content");
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc })).status, 502);
  eq(t.rows.get(PAIR).device_token, null);
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc: "not base64 at all!!" })).status, 409);
});

Deno.test("live activities: start by push-to-start, then update and end on the activity's own token", async () => {
  const t = setup();
  await t.call({ op: "hello", pair: PAIR, secret: SECRET });
  await t.call({ op: "register", pair: PAIR, secret: SECRET, env: "production", device: DEV, start: START });
  const state = { mood: "printing", headline: "Printing Cable clip", detail: "Layer 80 of 200", progress: 0.4, ends: 1_800_003_600, extra: "dropped" };
  eq((await t.call({ op: "activity", pair: PAIR, secret: SECRET, action: "start", key: "printer", title: "P1S", state })).status, 200);
  let s = t.sent.at(-1)!;
  eq([s.token, s.headers["apns-topic"], s.headers["apns-push-type"]], [START, "com.foxbuddy.phone.push-type.liveactivity", "liveactivity"]);
  eq(s.body.aps.event, "start"); eq(s.body.aps["attributes-type"], "FoxActivityAttributes"); eq(s.body.aps.attributes, { key: "printer", title: "P1S" });
  eq(s.body.aps["content-state"], { mood: "printing", headline: "Printing Cable clip", detail: "Layer 80 of 200", progress: 0.4, ends: 1_800_003_600 });
  // the phone reports the new activity's token; updates go there, quietly
  await t.call({ op: "register", pair: PAIR, secret: SECRET, activity: { key: "printer", token: ACT } });
  await t.call({ op: "activity", pair: PAIR, secret: SECRET, action: "update", key: "printer", state: { mood: "bogus", progress: 7 } });
  s = t.sent.at(-1)!;
  eq([s.token, s.headers["apns-priority"], s.body.aps.event, s.body.aps["content-state"].mood, s.body.aps["content-state"].progress], [ACT, "5", "update", "working", 1]);
  // a second "start" while it's showing just updates it
  await t.call({ op: "activity", pair: PAIR, secret: SECRET, action: "start", key: "printer", state });
  eq(t.sent.at(-1)!.token, ACT);
  await t.call({ op: "activity", pair: PAIR, secret: SECRET, action: "end", key: "printer", state: { mood: "done", headline: "Done" }, alert: { body: "Cable clip is done" } });
  s = t.sent.at(-1)!;
  eq([s.body.aps.event, s.headers["apns-priority"], typeof s.body.aps["dismissal-date"], s.body.aps.alert.body], ["end", "10", "number", "Cable clip is done"]);
  eq(t.rows.get(PAIR).activities, {});
  eq((await t.call({ op: "activity", pair: PAIR, secret: SECRET, action: "update", key: "printer", state })).status, 409);
});

Deno.test("an hourly limit, and unpairing forgets everything", async () => {
  const t = setup();
  await t.call({ op: "hello", pair: PAIR, secret: SECRET });
  await t.call({ op: "register", pair: PAIR, secret: SECRET, device: DEV });
  t.rows.get(PAIR).window_count = 240;
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc: "A".repeat(60) })).status, 429);
  t.rows.get(PAIR).window_start = new Date(Date.now() - 2 * 3600_000).toISOString();
  eq((await t.call({ op: "alert", pair: PAIR, secret: SECRET, enc: "A".repeat(60) })).status, 200);
  eq((await t.call({ op: "unpair", pair: PAIR, secret: SECRET })).status, 200);
  assert(!t.rows.has(PAIR));
});

Deno.test("APNs requests carry a valid ES256 token from the .p8 key", async () => {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const p8 = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n") + "\n-----END PRIVATE KEY-----\n";
  const real = globalThis.fetch;
  let seen: Request | null = null;
  globalThis.fetch = (async (u: string, init: RequestInit) => { seen = new Request(u, init); return new Response(null, { status: 200 }); }) as typeof fetch;
  try {
    const r = await apns(p8, "KEYID12345", "TEAMID1234")("sandbox", DEV, { "apns-topic": "t" }, { aps: {} });
    eq(r.status, 200);
  } finally { globalThis.fetch = real; }
  const req = seen as unknown as Request;
  eq(new URL(req.url).host, "api.sandbox.push.apple.com");
  const [h, p, sig] = req.headers.get("authorization")!.replace("bearer ", "").split(".");
  const dec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  eq(JSON.parse(new TextDecoder().decode(dec(h))), { alg: "ES256", kid: "KEYID12345" });
  eq(JSON.parse(new TextDecoder().decode(dec(p))).iss, "TEAMID1234");
  assert(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, dec(sig), new TextEncoder().encode(h + "." + p)), "signature verifies");
});
