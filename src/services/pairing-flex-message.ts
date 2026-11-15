import type { PairingResult } from "../dto/pairing-result";
import type { LineFlexBubble, LineFlexMessage } from "../dto/line-message";

export function createPairingFlexMessage(result: PairingResult): LineFlexMessage {
  const assignedMembers = new Set(
    result.hours.flatMap((hour) => [
      ...hour.courts.flatMap((court) => court.paireds.flatMap((pair) => pair.map(({ id }) => id))),
      ...hour.unassignedPairs.flatMap((pair) => pair.map(({ id }) => id)),
    ]),
  ).size;
  const bubbles = result.hours.length === 0
    ? [createHourBubble(result, assignedMembers, null, 0)]
    : result.hours.map((hour, index) => createHourBubble(result, assignedMembers, hour, index + 1));

  return {
    type: "flex",
    altText: `ผลจับคู่ ${assignedMembers} คน ${result.hours.length} รอบ`,
    contents: bubbles.length === 1
      ? bubbles[0]
      : { type: "carousel", contents: bubbles },
  };
}

function createHourBubble(
  result: PairingResult,
  assignedMembers: number,
  hour: PairingResult["hours"][number] | null,
  hourNumber: number,
): LineFlexBubble {
  const hourAssignedMembers = hour
    ? new Set([
      ...hour.courts.flatMap((court) => court.paireds.flatMap((pair) => pair.map(({ id }) => id))),
      ...hour.unassignedPairs.flatMap((pair) => pair.map(({ id }) => id)),
    ]).size
    : assignedMembers;
  const headerText = hour
    ? `${result.title}\nรอบ ${hour.startTime}–${hour.endTime}`
    : result.title;
  const bodyContents: LineFlexBubble["body"]["contents"] = [
    {
      type: "text",
      text: hour
        ? `${result.mode === "separate" ? "แยกคอร์ด" : "รวมคอร์ด"} · รอบ ${hourNumber}/${result.hours.length} · ${hourAssignedMembers} คน`
        : "ไม่มีช่วงเวลาที่สนามเปิดครบหนึ่งชั่วโมง",
      size: "sm",
      color: "#64748B",
      wrap: true,
    },
  ];

  if (hour) {
    for (const court of hour.courts) {
      const courtWaitingPairs = result.mode === "separate" ? court.paireds.slice(2) : [];
      bodyContents.push(
        { type: "separator" },
        {
          type: "text",
          text: `🏸  สนาม ${court.courtName}`,
          weight: "bold",
          size: "md",
          color: "#2453E8",
          wrap: true,
        },
        {
          type: "text",
          text: formatCourtPairs(court.paireds.slice(0, 2)),
          size: "sm",
          color: "#1F2937",
          wrap: true,
        },
      );

      if (courtWaitingPairs.length > 0) {
        bodyContents.push({
          type: "text",
          text: `⏳  รอคิว\n${formatPairs(courtWaitingPairs)}`,
          size: "sm",
          color: "#B45309",
          wrap: true,
        });
      }
    }

    if (result.mode === "combined" && hour.unassignedPairs.length > 0) {
      bodyContents.push({
        type: "separator",
      }, {
        type: "text",
        text: `⏳  รอคิวรวม\n${formatPairs(hour.unassignedPairs)}`,
        size: "sm",
        color: "#B45309",
        wrap: true,
      });
    }
  }

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E40AF",
      contents: [{
        type: "text",
        text: headerText,
        color: "#FFFFFF",
        weight: "bold",
        size: "lg",
        wrap: true,
      }],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents,
    },
  };
}

function formatPairs(pairs: PairingResult["hours"][number]["unassignedPairs"]): string {
  return pairs.map((pair, index) => `${index + 1}. ${formatPair(pair)}`).join("\n");
}

function formatCourtPairs(pairs: PairingResult["hours"][number]["unassignedPairs"]): string {
  if (pairs.length === 0) return "ยังไม่มีคู่";
  return pairs.map(formatPair).join("\nvs\n");
}

function formatPair(pair: PairingResult["hours"][number]["unassignedPairs"][number]): string {
  return pair.length === 1
    ? `${pair[0].name} (ยังไม่มีคู่)`
    : pair.map(({ name }) => name).join(" กับ ");
}
