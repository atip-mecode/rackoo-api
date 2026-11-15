import { Elysia, t } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { env } from "cloudflare:workers";
import { botProperty } from "./config/bot";
import { verifyLineSignature } from "./services/line-webhook";
import { parsePairingAnnouncement } from "./services/pairing-announcement";
import { processMessage } from "./services/process-message";
import { replyToLineMessage } from "./services/line-messaging-api";

export const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/health", () => ({ status: "ok" }))
  .post(
    "/pairings/parse",
    ({ body, set }) => {
      const result = parsePairingAnnouncement(body.text);
      if (!result.ok) set.status = 400;
      return result;
    },
    { body: t.Object({ text: t.String({ minLength: 1 }) }) },
  )
  .post(
    "/webhook/line",
    async ({ body, request, set }) => {
      const channelSecret = env.LINE_CHANNEL_SECRET;
      if (!channelSecret) {
        set.status = 503;
        return { ok: false, error: "LINE_CHANNEL_SECRET is not configured" };
      }

      const valid = await verifyLineSignature(
        body,
        request.headers.get("x-line-signature"),
        channelSecret,
      );
      if (!valid) {
        set.status = 401;
        return { ok: false, error: "Invalid LINE webhook signature" };
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        set.status = 400;
        return { ok: false, error: "Invalid JSON body" };
      }

      if (!isLineWebhookBody(payload)) {
        set.status = 400;
        return { ok: false, error: "Invalid LINE webhook payload" };
      }
      const results = await Promise.all(payload.events.map(async (event) => {
        if (event.type !== "message" || event.message?.type !== "text") {
          return { status: "ignored", reason: "not_text_message" } as const;
        }
        // const botMentioned = event.message.mention?.mentionees.some(
        //   (mentionee) => mentionee.userId === botProperty.id,
        // ) ?? false;
        // if (!botMentioned) return { status: "ignored", reason: "bot_not_mentioned" } as const;

        const processed = processMessage(event.message.text);
        if (!processed.handled) {
          return { status: "ignored", reason: "unsupported_command" } as const;
        }
        if (!event.replyToken) {
          return { status: "reply_failed", error: "Webhook event has no reply token" } as const;
        }

        const reply = await replyToLineMessage(
          event.replyToken,
          processed.messages,
          "a1m5wzAUU69mXJ6hk/60xG1Faea/NgDRGPU1p1WT3glNSwSmUSQWnW6wdVunLMdpKyBOOcaVak9iKglsePDAiuIuPjwqn+oCSOVA4Tfy5ZsE5CuYRaVPJLqAAHJ/Ahtu9E6SCNKpWOBhUIbncr8jCgdB04t89/1O/w1cDnyilFU=",
        );
        if (!reply.ok) console.error("LINE reply failed", reply.status, reply.error);
        return { status: reply.ok ? "replied" : "reply_failed", reply } as const;
      }));
      return { ok: true, results };
    },
    { parse: "text", body: t.String({ minLength: 1 }) },
  )
  .compile();

export default app;

type LineWebhookBody = {
  destination?: string;
  events: Array<{
    type: string;
    replyToken?: string;
    message?: {
      type: string;
      text: string;
      mention?: {
        mentionees: Array<{ userId?: string; isSelf?: boolean }>;
      };
    };
  }>;
};

function isLineWebhookBody(value: unknown): value is LineWebhookBody {
  if (typeof value !== "object" || value === null || !("events" in value)) return false;
  if (!Array.isArray(value.events)) return false;

  return value.events.every((event: unknown) => {
    if (typeof event !== "object" || event === null || !("type" in event)) return false;
    if ("replyToken" in event && typeof event.replyToken !== "string") return false;
    if (event.type !== "message") return true;
    if (!("message" in event) || typeof event.message !== "object" || event.message === null) return false;
    if (!("type" in event.message) || typeof event.message.type !== "string") return false;
    if (event.message.type !== "text") return true;
    if (!("text" in event.message) || typeof event.message.text !== "string") return false;
    if (!("mention" in event.message)) return true;
    if (typeof event.message.mention !== "object" || event.message.mention === null) return false;
    if (!("mentionees" in event.message.mention) || !Array.isArray(event.message.mention.mentionees)) return false;
    return event.message.mention.mentionees.every((mentionee: unknown) => {
      if (typeof mentionee !== "object" || mentionee === null) return false;
      if ("userId" in mentionee && typeof mentionee.userId !== "string") return false;
      if ("isSelf" in mentionee && typeof mentionee.isSelf !== "boolean") return false;
      return true;
    });
  });
}
