import assert from "node:assert/strict";
import test from "node:test";
import { selectAnnouncement } from "./announcement_service.ts";

test("only approved announcements enter the broadcast workflow", () => {
  const approved = selectAnnouncement({ title: "Patch live", message: "New maps are open.", assetIds: ["map-4"], liveEvent: "patch-4", moderationQueue: "global", approved: true });
  assert.equal(approved.approved, true);
  assert.throws(() => selectAnnouncement({ title: "Draft", message: "Pending review.", assetIds: [], liveEvent: "draft-1", moderationQueue: "global", approved: false }), /awaiting moderation/);
});
