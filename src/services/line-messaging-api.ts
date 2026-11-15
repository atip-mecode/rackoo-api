import type { LineReplyMessage } from "../dto/line-message";

type ReplyResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string };

export async function replyToLineMessage(
  replyToken: string,
  messages: LineReplyMessage[],
  channelAccessToken: string | undefined,
): Promise<ReplyResult> {
  if (!channelAccessToken) {
    return { ok: false, status: 503, error: "LINE_CHANNEL_ACCESS_TOKEN is not configured" };
  }
  if (messages.length === 0 || messages.length > 5) {
    return { ok: false, status: 400, error: "Reply requires between one and five messages" };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      authorization: `Bearer ${channelAccessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (response.ok) return { ok: true, status: response.status };
  return { ok: false, status: response.status, error: await response.text() };
}
