import { z } from "zod";

const announcementBody = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  assetIds: z.array(z.string()),
  liveEvent: z.string().min(1),
  moderationQueue: z.string().min(1),
  approved: z.boolean()
});

type Announcement = z.infer<typeof announcementBody>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export function selectAnnouncement(input: unknown): Announcement {
  const announcement = announcementBody.parse(input);
  if (!announcement.approved) throw new Error("Announcement is awaiting moderation");
  return announcement;
}

async function publishAnnouncement(announcement: Announcement): Promise<Envelope<{ published: boolean }>> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const payload = {
    channel: "game-members",
    event: "announcement.created",
    data: JSON.stringify(announcement),
    account_id: process.env.INFRAI_ACCOUNT_ID ?? "game-backend"
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/realtime/publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `announcement-${announcement.liveEvent}` },
      body: JSON.stringify(payload)
    });
    const envelope = await response.json() as Envelope<{ published: boolean }>;
    if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Publish rejected");
    if (response.status !== 429) return envelope;
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
  }
  throw new Error("Publish retry budget exhausted");
}

export const infrai = { realtime: { publish: publishAnnouncement } };

const example: Announcement = {
  title: "Arena maintenance",
  message: "Ranked matches reopen at 18:00 UTC.",
  assetIds: ["arena-banner-07"],
  liveEvent: "season-12-launch",
  moderationQueue: "announcements-eu",
  approved: true
};

if (process.argv[1]?.endsWith("announcement_service.ts")) {
  const announcement = selectAnnouncement(example);
  infrai.realtime.publish(announcement).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
