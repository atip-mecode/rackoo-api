import { Elysia, t } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { env } from "cloudflare:workers";
import { botProperty } from "./config/bot";
import { verifyLineSignature } from "./services/line-webhook";
import { parsePairingAnnouncement } from "./services/pairing-announcement";
import { createPairingFlexResponse } from "./services/pairing-flex-response";
import { processMessage } from "./services/process-message";
import { replyToLineMessage } from "./services/line-messaging-api";

export const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/health", () => ({ status: "ok" }))
  .post(
    "/pairings/parse",
    ({ body, set }) => {
      const startedAt = Date.now();
      const result = parsePairingAnnouncement(body.text);
      if (!result.ok) {
        set.status = 400;
      }
      logApiResponse("/pairings/parse", result.ok ? 200 : 400, Date.now() - startedAt);
      return result;
    },
    { body: t.Object({ text: t.String({ minLength: 1 }) }) },
  )
  .post(
    "/pairings/flex-message",
    ({ body, set }) => {
      const startedAt = Date.now();
      const result = createPairingFlexResponse(body.text, body.mode ?? "separate");
      if (!result.ok) {
        set.status = result.status;
        logApiError("/pairings/flex-message", result.status, result.reason);
        return result;
      }

      logApiResponse("/pairings/flex-message", 200, Date.now() - startedAt);
      return result;
    },
    {
      body: t.Object({
        text: t.String({ minLength: 1 }),
        mode: t.Optional(t.Union([t.Literal("separate"), t.Literal("combined")])),
      }),
    },
  )
  .post(
    "/webhook/line",
    async ({ body, request, set }) => {
      const startedAt = Date.now();
      const channelSecret = env.LINE_CHANNEL_SECRET;
      if (!channelSecret) {
        set.status = 503;
        logApiError("/webhook/line", 503, "missing_channel_secret");
        return { ok: false, error: "LINE_CHANNEL_SECRET is not configured" };
      }

      const valid = await verifyLineSignature(
        body,
        request.headers.get("x-line-signature"),
        channelSecret,
      );
      if (!valid) {
        set.status = 401;
        logApiError("/webhook/line", 401, "invalid_signature");
        return { ok: false, error: "Invalid LINE webhook signature" };
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        set.status = 400;
        logApiError("/webhook/line", 400, "invalid_json");
        return { ok: false, error: "Invalid JSON body" };
      }

      if (!isLineWebhookBody(payload)) {
        set.status = 400;
        logApiError("/webhook/line", 400, "invalid_payload");
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
          logApiError("/webhook/line", 502, "missing_reply_token");
          return { status: "reply_failed", error: "Webhook event has no reply token" } as const;
        }

        const reply = await replyToLineMessage(
          event.replyToken,
          processed.messages,
          env.LINE_CHANNEL_ACCESS_TOKEN,
        );
        if (!reply.ok) console.error(JSON.stringify({
          level: "error",
          event: "line.reply.failed",
          status: reply.status,
          error: reply.error,
        }));
        return { status: reply.ok ? "replied" : "reply_failed", reply } as const;
      }));
      logApiResponse("/webhook/line", 200, Date.now() - startedAt);
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

function logApiResponse(route: string, status: number, durationMs: number): void {
  console.info(JSON.stringify({ level: "info", event: "api.response", route, status, durationMs }));
}

function logApiError(route: string, status: number, reason: string): void {
  console.error(JSON.stringify({ level: "error", event: "api.error", route, status, reason }));
}

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
