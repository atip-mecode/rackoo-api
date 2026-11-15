import assert from "node:assert/strict";
import test from "node:test";
import { createPairingFlexResponse } from "./pairing-flex-response";

test("creates a Flex carousel from an announcement using separate courts by default", () => {
  const result = createPairingFlexResponse(`❤️ ศุกร์ 6/11
สนามแรก 18.00-21.00
สนามสอง 18.00-21.00
1. ดาด้า
2. บิ๊ก
3. นุ่น
4. ฟ้า`);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.message.type, "flex");
  assert.equal(result.message.contents.type, "carousel");
  if (result.message.contents.type === "carousel") {
    assert.equal(result.message.contents.contents.length, 3);
  }
});

test("returns a client error when an announcement has no courts", () => {
  const result = createPairingFlexResponse("❤️ ศุกร์ 6/11\n1. ดาด้า");

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 400);
  assert.match(result.error, /ไม่พบข้อมูลสนาม/u);
});
