export type PairingPlayer = {
  id: string;
  name: string;
};

export type PairingGroup = PairingPlayer[];
export type PairingMode = "separate" | "combined";

export type CourtRoundResult = {
  courtId: string;
  courtName: string;
  paireds: PairingGroup[];
};

export type HourlyPairingResult = {
  startTime: string;
  endTime: string;
  courts: CourtRoundResult[];
  unassignedPairs: PairingGroup[];
};

export type PairingResult = {
  title: string;
  mode: PairingMode;
  hours: HourlyPairingResult[];
};
