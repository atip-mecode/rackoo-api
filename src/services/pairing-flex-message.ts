import type { PairingResult } from "../dto/pairing-result";
import type { LineFlexMessage } from "../dto/line-message";

export function createPairingFlexMessage(result: PairingResult): LineFlexMessage {
  const assignedMembers = new Set(
    result.hours.flatMap((hour) => [
      ...hour.courts.flatMap((court) => court.paireds.flatMap((pair) => pair.map(({ id }) => id))),
      ...hour.unassignedPairs.flatMap((pair) => pair.map(({ id }) => id)),
    ]),
  ).size;
  const contents = result.hours.length === 0
    ? [{ type: "text" as const, text: "ไม่มีรอบที่สนามเปิดครบหนึ่งชั่วโมง", size: "sm" as const, wrap: true as const }]
    : result.hours.flatMap((hour) => {
      const centralWaitingPairs = result.mode === "combined" ? hour.unassignedPairs : [];
      return [
        { type: "separator" as const },
        { type: "text" as const, text: `🕒  รอบ ${hour.startTime}–${hour.endTime}`, weight: "bold" as const, size: "md" as const, color: "#1E3A8A" },
        ...hour.courts.flatMap((court) => {
          const courtWaitingPairs = result.mode === "separate" ? court.paireds.slice(2) : [];
          return [
            { type: "separator" as const },
            {
              type: "text" as const,
              text: `🏸  สนาม ${court.courtName}`,
              weight: "bold" as const,
              size: "md" as const,
              color: "#2453E8",
              wrap: true as const,
            },
            {
              type: "text" as const,
              text: formatCourtPairs(court.paireds.slice(0, 2)),
              size: "sm" as const,
              color: "#1F2937",
              wrap: true as const,
            },
            ...(courtWaitingPairs.length === 0
              ? []
              : [{
                type: "text" as const,
                text: `⏳  รอคิว\n${formatPairs(courtWaitingPairs)}`,
                size: "sm" as const,
                wrap: true as const,
                color: "#B45309",
              }]),
          ];
        }),
        ...(centralWaitingPairs.length === 0
          ? []
          : [{
            type: "text" as const,
            text: `⏳  รอคิวรวม\n${formatPairs(centralWaitingPairs)}`,
            size: "sm" as const,
            wrap: true as const,
            color: "#B45309",
          }]),
      ];
    });

  return {
    type: "flex",
    altText: `ผลจับคู่ ${assignedMembers} คน ${result.hours.length} รอบ`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1E40AF",
        contents: [{
          type: "text",
          text: result.title,
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
        contents: [
          { type: "text", text: `${result.mode === "separate" ? "แยกคอร์ด" : "รวมคอร์ด"} · จับคู่แล้ว ${assignedMembers} คน · ${result.hours.length} รอบ`, size: "sm", color: "#64748B" },
          ...contents,
        ],
      },
    },
  };
}

function formatPairs(pairs: PairingResult["hours"][number]["unassignedPairs"]): string {
  if (pairs.length === 0) return "ยังไม่มีคู่";
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
