# Fox Buddy's push relay

The meeting point between the fox on your Mac and the Fox Buddy iPhone app (`ios/`): a Supabase edge function
that sends Apple push notifications, and one table. The Mac posts alerts (encrypted) and Live Activity
updates; the phone registers its push tokens. See the top of `supabase/functions/foxbuddy-push/index.ts`
for the protocol.

The released Mac app uses the Fuchs Labs relay (`PhoneLink.builtInRelay` in `tools/foxbuddy/main.swift`).
To run your own (your own iPhone build, with your own bundle id and push key):

```sh
supabase link --project-ref <your project>
supabase db push                                     # the foxbuddy_pairs table
supabase functions deploy foxbuddy-push --no-verify-jwt
supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_TOPIC=<your bundle prefix>.phone
supabase secrets set APNS_KEY_P8="$(cat AuthKey_XXXXXXXXXX.p8)"
```

Then point your Mac at it: `"phone_relay": "https://<project>.supabase.co/functions/v1/foxbuddy-push"` in
`~/.desk-buddy/config.json`, and pair again.

**Tests:** `deno test --allow-env=SUPABASE_URL relay/supabase/functions/foxbuddy-push/index.test.ts` (a fake
database and a fake Apple; one test checks the push token's signature with a real P-256 key).

**Limits:** 240 pushes per pair per hour. Anyone can claim a new pair id (that's how pairing works), but a
pair is useless without its secret, and the secret is only ever stored hashed.
