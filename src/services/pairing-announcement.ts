import type {
  AnnouncementCourt,
  AnnouncementMember,
  PairingAnnouncement,
} from "../dto/pairing-announcement";

export type ParseAnnouncementError =
  | { code: "MISSING_COURTS" }
  | { code: "INVALID_TIME"; value: string };

type ParseResult =
  | { ok: true; value: PairingAnnouncement }
  | { ok: false; error: ParseAnnouncementError };

const courtLine = /^สนาม\s*(.+?)\s+(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})(?:\s+@all)?$/iu;
const compactCourt = /(?=สนาม[^\n]*?\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/gu;

/** Parse court announcements, including chat text pasted without line breaks. */
export function parsePairingAnnouncement(input: string): ParseResult {
  const lines = splitAnnouncement(input);
  let title = "";
  const courts: AnnouncementCourt[] = [];
  const members: AnnouncementMember[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!title) title = line;

    const court = line.match(courtLine);
    if (court) {
      const start = parseTime(court[2]);
      const end = parseTime(court[3]);
      if (!start || !end) return invalidTime(`${court[2]}-${court[3]}`);
      courts.push({
        name: court[1].trim().replace(/[.:]$/u, ""),
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
      });
      continue;
    }

    if (line.startsWith("สนาม")) return invalidTime(line);
    if (line.includes("@All") || line.includes("@all")) continue;

    const range = line.match(/(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})/u);
    const memberText = (range ? line.replace(range[0], "") : line)
      .replace(/\(\s*\)/gu, "")
      .trim();
    const member = memberText.match(/^(.*?)(?:\s*\(([^()]*)\))?$/u);
    const name = member?.[1]?.trim() ?? "";
    if (!name) continue;

    if (range) {
      const start = parseTime(range[1]);
      const end = parseTime(range[2]);
      if (!start || !end) return invalidTime(range[0]);
      members.push({
        name,
        note: member?.[2]?.trim() || null,
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
      });
      continue;
    }

    members.push({
      name,
      note: member?.[2]?.trim() || null,
      startHour: null,
      startMinute: null,
      endHour: null,
      endMinute: null,
    });
  }

  if (courts.length === 0) return { ok: false, error: { code: "MISSING_COURTS" } };
  return { ok: true, value: { title, courts, members } };
}

function splitAnnouncement(input: string): string[] {
  const courtSeparated = input
    .replace(compactCourt, "\n")
    .replace(/(\d{1,2}[.:]\d{2})(\d{1,2})[.)]\s*(?=[\p{L}])/gu, "$1\n$2 ");

  return courtSeparated.split(/\r?\n/u).flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line) return [];
    if (line.startsWith("สนาม")) return [line];

    return line
      .replace(/(?<=[\p{L})])(\d{1,2})[.)]\s*(?=[\p{L}\d]|$)/gu, "\n$1 ")
      .replace(/(?<=[\p{L}])(\d{1,2})\s+(?=[\p{L}])/gu, "\n$1 ")
      .replace(/(^|\s)(\d{1,2})[.)](?=\s|$)/gmu, "$1\n$2 ")
      .replace(/(^|\s)(\d{1,2})\s+(?=[\p{L}])/gmu, "$1\n$2 ")
      .split(/\r?\n/u)
      .map((memberLine) => memberLine.replace(/^\s*\d{1,2}[.)]?\s*/u, "").trim())
      .filter(Boolean);
  });
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{1,2})[.:](\d{2})$/u);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function invalidTime(value: string): ParseResult {
  return { ok: false, error: { code: "INVALID_TIME", value } };
}
