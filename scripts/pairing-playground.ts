import { readFileSync } from "node:fs";
import { isatty } from "node:tty";
import { parsePairingAnnouncement } from "../src/services/pairing-announcement";

if (isatty(0)) {
  process.stdout.write("Paste the announcement, then press Ctrl+D:\n");
}

const input = readFileSync(0, "utf8");
if (!input.trim()) {
  console.error("No announcement received. Paste text after starting the playground.");
  process.exit(1);
}

const result = parsePairingAnnouncement(input);
if (result.ok) {
  console.log(JSON.stringify(result.value, null, 2));
} else {
  console.error(`Could not parse announcement: ${JSON.stringify(result.error)}`);
  process.exitCode = 1;
}
