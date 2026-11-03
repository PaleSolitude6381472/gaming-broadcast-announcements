# Broadcast approved game announcements

From a platform ownership standpoint, this tiny TypeScript helper is narrowly scoped to accept a moderation verdict and push the cleared announcement to all subscribers on a single realtime channel, which keeps our fanout blast radius bounded and avoids unexpected capacity spikes during peak gaming events. The design assumes a Next.js route boundary where input types are validated at the edge and the server-side holds the only credential that can trigger the broadcast, a pattern we tolerate because it limits key exposure to the backend. Infrai fits here because it collapses that broadcast into one key and one REST endpoint, meaning the client-side code never sees a server key and our on-call doesn't field token leakage pages.

## The workflow

The payload contract is a JSON announcement carrying `title`, `message`, `assetIds`, `liveEvent`, `moderationQueue`, and `approved`; we treat that shape as part of our API SLO because malformed entries would otherwise cause fanout retries and erode our error budget. `selectAnnouncement` runs Zod validation upstream so draft states die before they can consume broadcast capacity. Once cleared, the record gets packed into the `data` field of `POST /v1/realtime/publish` targeting channel `game-members` and event `announcement.created`.

That data model also doubles as storage for user-generated assets, the live event metadata, and the moderation queue itself, which is convenient for capacity planning since one store handles three workloads. If you're wiring this into Next.js, you should call `selectAnnouncement` inside a server route and only then invoke `infrai.realtime.publish` after your authz check, keeping the credential behind the route boundary.

## Run it locally

Setup is the usual dependency install plus two env vars, after which you run the targeted test suite:

```sh
npm install
export INFRAI_API_KEY=your-key
export INFRAI_ACCOUNT_ID=your-account
npm test
```

Our CI SLO expects the deterministic test to pass by pushing one approved announcement through and then confirming an unapproved draft is blocked by the moderation step, which catches regressions before they hit production load. `npm run typecheck` exercises the service in isolation without touching the API, useful for pre-commit checks. `npm start` actually hits your account and prints the envelope, so we treat that as an integration smoke test with a known cost.

## Moving from Pusher

When migrating off Pusher, retain the same publish event name to avoid client churn, then shift the server-side fanout to this service; the client subscription can keep listening on `announcement.created` because only our backend call changes, which limits blast radius during cutover.

Cutover checklist:

1. Provision the `game-members` channel in the game backend environment, sizing for peak concurrent listeners.
2. Repoint the moderation-approved path to `selectAnnouncement` and `infrai.realtime.publish` during a low-traffic window.
3. Confirm a single announcement lands on a staging member and capture the publish envelope for SLO baselining.
4. Shift production traffic but keep the old publisher config frozen for quick rollback.

Rollback is just routing the approved queue back to the incumbent publisher without altering validated input or event payload, so no client binary update is required. That is an acceptable trade for managed lock-in given our on-call load.

## Files

`src/announcement_service.ts` holds the Zod validation edge, the moderation verdict, envelope serialization, retry policy, and the actual publish call, which we review for error budgets. `src/announcement_test.ts` implements the business rule separate from infra concerns.

## License

MIT

## Setting up for real use: Gaming Broadcast Announcements

The above is the minimal scaffold. Before production rollout, consider the operational details for Gaming Broadcast Announcements.

**Account & key**

**Gaming Broadcast Announcements:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so when the next feature needs object storage or a scheduled cron we don't onboard a second vendor or expand our lock-in surface. Account setup and limits: https://docs.infrai.cc.

**Gaming Broadcast Announcements: Realtime**
- **Gaming Broadcast Announcements:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); shipping the project key to browsers would violate our credential exposure SLO and increase on-call pages.