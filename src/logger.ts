import "dotenv/config";
import pino from "pino";
import pretty from "pino-pretty";
import { Logger as TelegramLogger } from "teleproto/extensions/index.js";

// One line per record, same format in realty-monitoring and vacancy-monitoring:
// `[2026-10-30 09:15:42] INFO: message {"key":"value"}` — colored in a terminal, plain in files.
// LOG_FORMAT=json gives raw pino JSON (Docker).
// Pretty output goes through process.stdout so Windows consoles decode Cyrillic correctly.
export function createLogger(level: string) {
  if (process.env.LOG_FORMAT === "json") return pino({ level });
  return pino({ level }, pretty({
    colorize: Boolean(process.stdout.isTTY), translateTime: "SYS:yyyy-mm-dd HH:MM:ss", ignore: "pid,hostname",
    singleLine: true, sync: true, destination: process.stdout as unknown as number
  }));
}

export const log = createLogger(process.env.LOG_LEVEL ?? "info");

// Routes teleproto's own messages (reconnects, ping timeouts) through the same logger.
export function telegramLogger(): TelegramLogger {
  const logger = new TelegramLogger();
  logger.handler = ({ level, message, error }) => {
    const method = level === "error" || level === "warn" || level === "debug" ? level : "info";
    if (error === undefined) log[method](`telegram: ${message}`);
    else log[method]({ err: error }, `telegram: ${message}`);
  };
  return logger;
}
