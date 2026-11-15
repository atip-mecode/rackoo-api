import type { PairingAnnouncement } from "../dto/pairing-announcement";
import type {
  CourtRoundResult,
  HourlyPairingResult,
  PairingMode,
  PairingGroup,
  PairingPlayer,
  PairingResult,
} from "../dto/pairing-result";

type ScheduledPlayer = PairingPlayer & { start: number; end: number };
type ReadySlot = { kind: "ready"; player: ScheduledPlayer };
type NotReadySlot = { kind: "not_ready"; player: ScheduledPlayer | null };
type Slot = ReadySlot | NotReadySlot;
type CandidatePair = readonly [Slot, Slot];
type FilledPair = ReadySlot[];

const MINUTES_PER_HOUR = 60;
const PAIRS_PER_COURT = 2;

/** Create hourly pairing results using the bmt circle-round and missing-player logic. */
export function createPairingResult(
  input: PairingAnnouncement,
  mode: PairingMode = "separate",
): PairingResult | null {
  if (input.courts.length === 0) return null;

  const courtRanges = input.courts.map((court, index) => ({
    id: `court-${index + 1}`,
    court,
    start: toMinutes(court.startHour, court.startMinute),
    end: toMinutes(court.endHour, court.endMinute),
  }));
  const defaultStart = Math.min(...courtRanges.map(({ start }) => start));
  const defaultEnd = Math.max(...courtRanges.map(({ end }) => end));
  const players: ScheduledPlayer[] = input.members.map((member, index) => ({
    id: `player-${index + 1}`,
    name: member.name,
    start: member.startHour === null || member.startMinute === null
      ? defaultStart
      : toMinutes(member.startHour, member.startMinute),
    end: member.endHour === null || member.endMinute === null
      ? defaultEnd
      : toMinutes(member.endHour, member.endMinute),
  }));

  const roundCount = Math.max(0, players.length - 1);
  const roundOrder = shuffle(Array.from({ length: roundCount }, (_, round) => round));
  const previousPairCounts = new Map<string, number>();
  const playedHours = new Map<string, number>();
  const hours: HourlyPairingResult[] = [];
  let activeHourIndex = 0;

  for (let start = defaultStart; start + MINUTES_PER_HOUR <= defaultEnd; start += MINUTES_PER_HOUR) {
    const end = start + MINUTES_PER_HOUR;
    const activeCourts = courtRanges.filter(({ start: courtStart, end: courtEnd }) =>
      courtStart <= start && courtEnd >= end,
    );
    if (activeCourts.length === 0) continue;

    const roundIndex = roundOrder.length === 0
      ? null
      : roundOrder[activeHourIndex % roundOrder.length];
    const candidates = roundIndex === null
      ? []
      : shuffle(createCircleRound(players, start, end, roundIndex));
    const pairs = fillMissingPlayers(candidates, previousPairCounts)
      .sort((first, second) => comparePairPriority(first, second, playedHours));
    const readyPairs = pairs.map((pair) => pair.map(({ player }) => ({
      id: player.id,
      name: player.name,
    })));
    const courts: CourtRoundResult[] = activeCourts.map(({ court, id }, courtIndex) => ({
      courtId: id,
      courtName: court.name,
      paireds: mode === "separate"
        ? readyPairs.filter((_, pairIndex) => pairIndex % activeCourts.length === courtIndex)
        : readyPairs.slice(courtIndex * PAIRS_PER_COURT, (courtIndex + 1) * PAIRS_PER_COURT),
    }));

    updatePlayedHours(pairs, playedHours);
    updatePreviousPairCounts(pairs, previousPairCounts);
    hours.push({
      startTime: formatTime(start),
      endTime: formatTime(end),
      courts,
      unassignedPairs: mode === "separate" ? [] : readyPairs.slice(activeCourts.length * PAIRS_PER_COURT),
    });
    activeHourIndex += 1;
  }

  return { title: input.title, mode, hours };
}

function createCircleRound(
  players: readonly ScheduledPlayer[],
  start: number,
  end: number,
  round: number,
): CandidatePair[] {
  if (players.length === 0) return [];

  const circle: (ScheduledPlayer | null)[] = players.length % 2 === 0
    ? [...players]
    : [...players, null];
  const [anchor, ...rotating] = circle;
  const offset = round % rotating.length;
  const rotated = offset === 0
    ? rotating
    : [...rotating.slice(-offset), ...rotating.slice(0, -offset)];
  const ordered = [anchor, ...rotated];

  const visibility = (player: ScheduledPlayer | null): Slot => {
    if (player && player.start <= start && player.end >= end) {
      return { kind: "ready", player };
    }
    return { kind: "not_ready", player };
  };

  return Array.from({ length: ordered.length / 2 }, (_, index) => [
    visibility(ordered[index]),
    visibility(ordered[ordered.length - 1 - index]),
  ]);
}

function fillMissingPlayers(
  candidates: readonly CandidatePair[],
  previousPairCounts: ReadonlyMap<string, number>,
): FilledPair[] {
  const completePairs: FilledPair[] = [];
  const singles: ReadySlot[] = [];

  for (const [first, second] of candidates) {
    if (first.kind === "ready" && second.kind === "ready") {
      completePairs.push([first, second]);
      continue;
    }
    if (first.kind === "ready") singles.push(first);
    if (second.kind === "ready") singles.push(second);
  }

  const repairedPairs = [...completePairs];
  while (singles.length > 1) {
    const first = singles.shift();
    if (!first) break;

    let partnerIndex = 0;
    for (let index = 1; index < singles.length; index += 1) {
      const candidateCount = previousPairCounts.get(pairKey(first.player.id, singles[index].player.id)) ?? 0;
      const selectedCount = previousPairCounts.get(pairKey(first.player.id, singles[partnerIndex].player.id)) ?? 0;
      if (candidateCount < selectedCount) partnerIndex = index;
    }
    const [partner] = singles.splice(partnerIndex, 1);
    repairedPairs.push([first, partner]);
  }

  if (singles.length === 1) repairedPairs.push([singles[0]]);
  return repairedPairs;
}

function comparePairPriority(
  first: FilledPair,
  second: FilledPair,
  playedHours: ReadonlyMap<string, number>,
): number {
  const occupancy = second.length - first.length;
  if (occupancy !== 0) return occupancy;
  const firstPlayed = first.reduce((total, slot) => total + (playedHours.get(slot.player.id) ?? 0), 0);
  const secondPlayed = second.reduce((total, slot) => total + (playedHours.get(slot.player.id) ?? 0), 0);
  return firstPlayed - secondPlayed;
}

function updatePlayedHours(pairs: readonly FilledPair[], playedHours: Map<string, number>): void {
  const playerIds = new Set(pairs.flatMap((pair) => pair.map(({ player }) => player.id)));
  for (const playerId of playerIds) {
    playedHours.set(playerId, (playedHours.get(playerId) ?? 0) + 1);
  }
}

function updatePreviousPairCounts(
  pairs: readonly FilledPair[],
  previousPairCounts: Map<string, number>,
): void {
  for (const pair of pairs) {
    if (pair.length !== 2) continue;
    const key = pairKey(pair[0].player.id, pair[1].player.id);
    previousPairCounts.set(key, (previousPairCounts.get(key) ?? 0) + 1);
  }
}

function pairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join("\u0000");
}

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function toMinutes(hour: number, minute: number): number {
  return hour * MINUTES_PER_HOUR + minute;
}

function formatTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minute = totalMinutes % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
