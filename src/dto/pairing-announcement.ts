export type PairingAnnouncement = {
  title: string;
  courts: AnnouncementCourt[];
  members: AnnouncementMember[];
};

export type AnnouncementCourt = {
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export type AnnouncementMember = {
  name: string;
  note: string | null;
  startHour: number | null;
  startMinute: number | null;
  endHour: number | null;
  endMinute: number | null;
};

