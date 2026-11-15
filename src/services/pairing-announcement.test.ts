import assert from "node:assert/strict";
import test from "node:test";
import { parsePairingAnnouncement } from "./pairing-announcement";

test("ignores the announcement title and parses members without @All", () => {
  const result = parsePairingAnnouncement(`❤️ ศุกร์ 6/11
สนามแรก 18.00-21.00
สนามสอง 18.00-21.00
1. ดาด้าเกิดวันอังคาร
2. บิ๊กเกิดวันอังคาร3. นุ่นรอวันเกิด`);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.title, "❤️ ศุกร์ 6/11");
  assert.deepEqual(result.value.courts.map(({ name }) => name), ["แรก", "สอง"]);
  assert.deepEqual(result.value.members.map(({ name }) => name), [
    "ดาด้าเกิดวันอังคาร",
    "บิ๊กเกิดวันอังคาร",
    "นุ่นรอวันเกิด",
  ]);
});

test("parses court lines with @All and member times with multiple parenthetical notes", () => {
  const result = parsePairingAnnouncement(`❤️ ศุกร์ 6/11 @All
สนามแรก 18.00-21.00 @All
สนามสอง 18.00-21.00 @All
1. ฟ้าเกิดพุธ (ไม่ใช่กลางคืน)(18.00-20.00)2. ผึ้ง 19.00-21.00`);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.courts.length, 2);
  assert.deepEqual(result.value.members, [
    {
      name: "ฟ้าเกิดพุธ",
      note: "ไม่ใช่กลางคืน",
      startHour: 18,
      startMinute: 0,
      endHour: 20,
      endMinute: 0,
    },
    {
      name: "ผึ้ง",
      note: null,
      startHour: 19,
      startMinute: 0,
      endHour: 21,
      endMinute: 0,
    },
  ]);
});
