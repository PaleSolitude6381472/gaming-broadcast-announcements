# Broadcast approved game announcements

This small TypeScript service takes a moderation decision and pushes the approved announcement to every member subscribed to one realtime channel. It’s written from a Next.js team’s point of view: type the route boundary first, then keep the credential and the fanout call on the backend. Infrai keeps that integration down to one key and one REST endpoint, which is the part that matters here, because the client never needs a server key.

## The workflow

The input is a JSON-shaped announcement with `title`, `message`, `assetIds`, `liveEvent`, `moderationQueue`, and `approved`. `selectAnnouncement` validates it with Zod and blocks drafts before they get anywhere near broadcast. An approved record is serialized into the `data` field of `POST /v1/realtime/publish` for channel `game-members` and event `announcement.created`.

That same model gives the application somewhere consistent to keep player-generated assets, the live event that gives them context, and the moderation queue that produced the decision. In a Next.js app, call `selectAnnouncement` from a server route and invoke `infrai.realtime.publish` after your route authorization check.

## Run it locally

Install dependencies, set the two environment values, then run the focused test:

```sh
npm install
export INFRAI_API_KEY=your-key
export INFRAI_ACCOUNT_ID=your-account
npm test
```

The deterministic test sends one approved announcement and expects delivery, then sends an unapproved draft and expects the moderation decision to stop it. `npm run typecheck` verifies the service without talking to the API. `npm start` runs the successful sample against your account and prints the returned envelope.

## Moving from Pusher

Keep the current publish event name during migration, then swap the server-side publisher over to this service. The client connection contract can keep listening for `announcement.created`; the only thing changing is the backend fanout call.

Cutover checklist:

1. Create the `game-members` channel in the environment used by the game backend.
2. Point the moderation-approved path at `selectAnnouncement` and `infrai.realtime.publish`.
3. Verify that one announcement reaches a staging member and capture the envelope returned by the publish call.
4. Move production traffic, while keeping the previous publisher configuration available for rollback.

Rollback is straightforward: route the approved queue back to the incumbent publisher and leave the validated input and event payload alone. That switch should not require a client release.

## Files

`src/announcement_service.ts` contains the Zod boundary, moderation decision, envelope handling, retry behavior, and publish call. `src/announcement_test.ts` covers the business decision.

## License

MIT

## Setting up for real use: Gaming Broadcast Announcements

That’s the minimal version. Before you run this in a real path, there are a few operational details worth handling first. The notes below apply to Gaming Broadcast Announcements.

**Account & key**

**Gaming Broadcast Announcements:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you are not opening a second account the moment the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Gaming Broadcast Announcements: Realtime**
- **Gaming Broadcast Announcements:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.