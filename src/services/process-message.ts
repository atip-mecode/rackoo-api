import { processPairingCommand } from "./process-pairing-command";

export type ProcessMessageResult =
  | ReturnType<typeof processPairingCommand>
  | { handled: false; reason: "missing_command" | "unknown_command"; command?: string };

/** Dispatch the first command token in a message. */
export function processMessage(text: string): ProcessMessageResult {
  const message = text.trimStart();
  const command = message.match(/^(\S+)/u)?.[1];
  if (!command) return { handled: false, reason: "missing_command" };

  if (command === "จับคู่" || command === "จับคู่รวม") {
    const announcement = message.slice(command.length).trim();
    return processPairingCommand(announcement, command === "จับคู่" ? "separate" : "combined");
  }

  return { handled: false, reason: "unknown_command", command };
}
