import type { LineFlexMessage } from "../dto/line-message";
import type { PairingMode } from "../dto/pairing-result";
import { createPairingResult } from "./create-pairing-result";
import { parsePairingAnnouncement } from "./pairing-announcement";
import { createPairingFlexMessage } from "./pairing-flex-message";

export type PairingFlexResponse =
  | { ok: true; message: LineFlexMessage }
  | { ok: false; status: 400 | 422; reason: string; error: string };

export function createPairingFlexResponse(
  text: string,
  mode: PairingMode = "separate",
): PairingFlexResponse {
  const parsed = parsePairingAnnouncement(text);
  if (!parsed.ok) {
    if (parsed.error.code === "MISSING_COURTS") {
      return {
        ok: false,
        status: 400,
        reason: "missing_courts",
        error: "ไม่พบข้อมูลสนาม กรุณาส่งชื่อสนามพร้อมเวลา เช่น สนามแรก 18.00-21.00",
      };
    }

    return {
      ok: false,
      status: 400,
      reason: parsed.error.code.toLowerCase(),
      error: `รูปแบบเวลาไม่ถูกต้อง: ${parsed.error.value}`,
    };
  }

  const pairing = createPairingResult(parsed.value, mode);
  if (!pairing || pairing.hours.length === 0) {
    return {
      ok: false,
      status: 422,
      reason: "no_playable_hours",
      error: "ไม่พบช่วงเวลาที่สนามเปิดครบหนึ่งชั่วโมง",
    };
  }

  return { ok: true, message: createPairingFlexMessage(pairing) };
}
