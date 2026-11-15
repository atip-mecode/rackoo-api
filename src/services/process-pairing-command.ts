import type { LineReplyMessage } from "../dto/line-message";
import { createPairingResult } from "./create-pairing-result";
import { parsePairingAnnouncement } from "./pairing-announcement";
import { createPairingFlexMessage } from "./pairing-flex-message";
import type { PairingMode } from "../dto/pairing-result";

export type PairingCommandResult = {
  handled: true;
  command: "จับคู่" | "จับคู่รวม";
  messages: LineReplyMessage[];
};

/** Execute the pairing command and build the reply appropriate to its result. */
export function processPairingCommand(announcement: string, mode: PairingMode = "separate"): PairingCommandResult {
  const command = mode === "separate" ? "จับคู่" : "จับคู่รวม";
  const result = parsePairingAnnouncement(announcement);
  console.log(result)
  if (result.ok) {
    const pairing = createPairingResult(result.value, mode);
    if (!pairing || pairing.hours.length === 0) {
      return {
        handled: true,
        command,
        messages: [{ type: "text", text: "ไม่พบช่วงเวลาที่สนามเปิดครบหนึ่งชั่วโมง" }],
      };
    }

    return {
      handled: true,
      command,
      messages: [createPairingFlexMessage(pairing)],
    };
  }

  const text = result.error.code === "MISSING_COURTS"
    ? "ไม่พบข้อมูลสนาม กรุณาส่งชื่อสนามพร้อมเวลา เช่น สนามแรก 18.00-21.00"
    : `รูปแบบเวลาไม่ถูกต้อง: ${result.error.value}`;

  return {
    handled: true,
    command,
    messages: [{ type: "text", text }],
  };
}
