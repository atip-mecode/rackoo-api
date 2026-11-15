import { botProperty } from "../config/bot";
import { processPairingCommand } from "./process-pairing-command";

export type ProcessMessageResult =
  | ReturnType<typeof processPairingCommand>
  | { handled: false; reason: "missing_bot_name" | "missing_command" | "unknown_command"; command?: string };

/** Dispatch a message command after the webhook has confirmed a real bot mention. */
export function processMessage(text: string): ProcessMessageResult {
  const message = text.trimStart();
  if (!message.startsWith(botProperty.name)) {
    return { handled: false, reason: "missing_bot_name" };
  }

  const commandText = message.slice(botProperty.name.length).trimStart();
  const command = commandText.match(/^(\S+)/u)?.[1];
  if (!command) return { handled: false, reason: "missing_command" };

  if (command === "จับคู่" || command === "จับคู่รวม") {
    const announcement = commandText.slice(command.length).trim();
    return processPairingCommand(announcement, command === "จับคู่" ? "separate" : "combined");
  }

  return { handled: false, reason: "unknown_command", command };
}
