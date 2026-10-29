import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import { NewMessage, EditedMessage } from "teleproto/events/index.js";
import type { Vacancy } from "./types.js";
import { guessCountryCode } from "./providers/utils.js";

export interface TelegramCredentials { apiId?: number; apiHash?: string; session?: string; }

export function telegramPostToVacancy(channel: string, message: any): Vacancy | undefined {
  const text = String(message?.message ?? "").trim();
  if (!text) return undefined;
  if (/\b(?:looking for (?:a )?job|seeking (?:a )?job|busco trabajo|suche arbeit)\b|(?:шукаю|ищу)\s+(?:роботу|работу)/iu.test(text)) return undefined;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = (lines[0] ?? "Вакансія").replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 200);
  const companyMatch = text.match(/(?:company|компанія|компания)\s*[:—-]\s*([^\n]{2,100})/i);
  const locationMatch = text.match(/(?:location|локація|город|місто)\s*[:—-]\s*([^\n]{2,100})/i);
  const salaryMatch = text.match(/(?:\$|USD\s*)(\d[\d\s]*)\s*(?:[-–—]\s*(?:\$|USD\s*)?(\d[\d\s]*))?/i);
  const id = Number(message.id);
  const location = locationMatch?.[1]?.trim() ?? (/remote|віддалено|удаленно/i.test(text) ? "Remote" : "Не вказано");
  return { id: `telegram-${channel}-${id}`, title, company: companyMatch?.[1]?.trim() ?? `@${channel}`,
    location, countryCode: guessCountryCode(location), description: text.slice(0, 1000), tags: [],
    salaryFrom: salaryMatch?.[1] ? Number(salaryMatch[1].replace(/\s/g, "")) : undefined,
    salaryTo: salaryMatch?.[2] ? Number(salaryMatch[2].replace(/\s/g, "")) : undefined,
    currency: salaryMatch ? "USD" : undefined, employmentType: /part.?time|часткова/i.test(text) ? "part-time" : "full-time",
    remote: /remote|віддалено|удаленно|worldwide/i.test(text),
    postedAt: new Date(Number(message.date) * 1000).toISOString(), source: "telegram",
    url: `https://t.me/${channel}/${id}` };
}

export async function startTelegramCollector(credentials: TelegramCredentials, channels: string[],
  onVacancy: (vacancy: Vacancy) => Promise<void>): Promise<(() => Promise<void>) | undefined> {
  if (!credentials.apiId || !credentials.apiHash || !credentials.session) return undefined;
  const client = new TelegramClient(new StringSession(credentials.session), credentials.apiId, credentials.apiHash,
    { connectionRetries: 10, autoReconnect: true });
  await client.connect();
  if (!await client.checkAuthorization()) throw new Error("TG_SESSION не авторизована");
  const active = () => new Set(channels.map((c) => c.toLowerCase()));
  const handle = async (event: any) => {
    const message = event.message;
    if (message?.peerId?.className !== "PeerChannel") return;
    const chat = await message.getChat();
    const channel = String(chat?.username ?? "").replace(/^@/, "");
    if (!channel || !active().has(channel.toLowerCase())) return;
    const vacancy = telegramPostToVacancy(channel, message);
    if (vacancy) await onVacancy(vacancy);
  };
  client.addEventHandler((event) => void handle(event), new NewMessage({}));
  client.addEventHandler((event) => void handle(event), new EditedMessage({}));

  for (const channel of [...channels]) {
    try {
      for await (const message of client.iterMessages(`@${channel}`, { limit: 50 })) {
        const vacancy = telegramPostToVacancy(channel, message);
        if (vacancy) await onVacancy(vacancy);
      }
    } catch (error) { console.warn(`Telegram @${channel} backfill failed:`, error); }
  }
  return async () => { await client.disconnect(); };
}
