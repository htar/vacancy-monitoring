import type { Store } from "./database.js";
import type { SearchFilters, SourceId } from "./search.js";
import { SOURCE_IDS, salaryUsd } from "./search.js";
import type { Vacancy } from "./types.js";
import type { ScanSummary } from "./scanner.js";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export class TelegramBot {
  private offset = 0;
  private stopped = false;
  constructor(private token: string, private chatId: string,
    private runScan: () => Promise<ScanSummary>, private startedAt = new Date()) {}

  private async call(method: string, body: Record<string, unknown>): Promise<any> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(35_000)
    });
    const data = await response.json() as any;
    if (!response.ok || !data.ok) throw new Error(data.description ?? `Bot API ${response.status}`);
    return data.result;
  }

  async sendVacancy(v: Vacancy): Promise<void> {
    const salary = v.salaryFrom || v.salaryTo
      ? `${v.salaryFrom ?? ""}${v.salaryTo ? `–${v.salaryTo}` : ""} ${v.currency ?? ""}` : "не вказана";
    await this.call("sendMessage", { chat_id: this.chatId, parse_mode: "HTML", disable_web_page_preview: false,
      text: `💼 <b>${escape(v.title)}</b>\n🏢 ${escape(v.company)}\n📍 ${escape(v.location)}${v.remote ? " · віддалено" : ""}\n💰 ${salary}${salaryUsd(v) ? ` (~${salaryUsd(v)} USD)` : ""}\n📡 ${v.source}\n\n${escape(v.description.slice(0, 600))}\n\n<a href="${v.url}">Відкрити вакансію</a>` });
  }

  async sendText(text: string): Promise<void> {
    await this.call("sendMessage", { chat_id: this.chatId, parse_mode: "HTML", text });
  }

  async run(store: Store, filters: SearchFilters): Promise<void> {
    while (!this.stopped) {
      try {
        const updates = await this.call("getUpdates", { offset: this.offset, timeout: 25, allowed_updates: ["message"] });
        for (const update of updates) {
          this.offset = update.update_id + 1;
          const message = update.message;
          if (!message?.text || String(message.chat.id) !== this.chatId) continue;
          const [raw, ...rest] = String(message.text).trim().split(/\s+/);
          const command = raw?.split("@")[0]?.toLowerCase();
          const response = await this.command(command ?? "", rest.join(" "), store, filters);
          if (response) await this.sendText(response);
        }
      } catch (error) {
        console.error("Bot polling failed:", error);
        if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async command(command: string, args: string, store: Store, filters: SearchFilters): Promise<string | undefined> {
    if (command === "/start" || command === "/help") return this.help();
    if (command === "/filters") return this.filters(filters);
    if (command === "/search") {
      const values = args.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
      if (!values.length) return "❌ Приклад: /search frontend, react, typescript";
      filters.search = values; store.saveFilters(filters); return `✅ Пошук: ${escape(values.join(", "))}`;
    }
    if (command === "/exclude") {
      filters.exclude = args === "off" ? [] : args.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
      store.saveFilters(filters); return `✅ Виключення: ${escape(filters.exclude.join(", ") || "немає")}`;
    }
    if (command === "/country") {
      const code = args.trim().toUpperCase();
      if (code !== "OFF" && code && !/^[A-Z]{2}$/.test(code)) return "❌ Код країни: UA, PL, DE або off";
      filters.countryCode = code === "OFF" ? "" : code; store.saveFilters(filters); return `✅ Країна: ${filters.countryCode || "будь-яка"}`;
    }
    if (command === "/format") {
      if (!["any", "remote", "onsite"].includes(args)) return "❌ /format any|remote|onsite";
      filters.workFormat = args as SearchFilters["workFormat"]; store.saveFilters(filters); return `✅ Формат: ${args}`;
    }
    if (command === "/days") {
      const days = Number(args); if (!Number.isInteger(days) || days < 1 || days > 90) return "❌ /days 7 (1–90)";
      filters.postedWithinDays = days; store.saveFilters(filters); return `✅ Давність: ${days} дн.`;
    }
    if (command === "/salary") {
      const salary = args === "off" ? 0 : Number(args); if (!Number.isFinite(salary) || salary < 0) return "❌ /salary 1500 або /salary off";
      filters.minSalaryUsd = salary; store.saveFilters(filters); return `✅ Мінімальна зарплата: ${salary || "не задана"} USD`;
    }
    if (command === "/sources") return `📡 ${SOURCE_IDS.map((s) => `${filters.sources.includes(s) ? "✅" : "▫️"} ${s}`).join("\n")}\n\n/source on|off назва`;
    if (command === "/source") {
      const [mode, id] = args.toLowerCase().split(/\s+/) as [string, SourceId];
      if (!SOURCE_IDS.includes(id) || !["on", "off"].includes(mode)) return "❌ /source on workua або /source off linkedin";
      const next = mode === "on" ? [...new Set([...filters.sources, id])] : filters.sources.filter((s) => s !== id);
      if (!next.length) return "❌ Має залишитися хоча б одне джерело";
      filters.sources = next;
      store.saveFilters(filters); return `✅ ${id}: ${mode}`;
    }
    if (command === "/scan") {
      const s = await this.runScan(); return `✅ Перевірено: ${s.fetched}\nВідповідають: ${s.matched}\nНових: ${s.added}\nПомилки: ${s.failedSources.join(", ") || "немає"}`;
    }
    if (command === "/status" || command === "/health") {
      const s = store.stats(); const uptime = Math.floor((Date.now() - this.startedAt.getTime()) / 60_000);
      return `🩺 Uptime: ${uptime} хв.\nЗбережено: ${s.processed}\nНадіслано: ${s.notified ?? 0}\nУ черзі: ${s.pending ?? 0}`;
    }
    return undefined;
  }

  private filters(f: SearchFilters) {
    return `🔎 <b>Фільтри</b>\nКлючові слова: ${escape(f.search.join(", "))}\nВиключення: ${escape(f.exclude.join(", ") || "немає")}\nКраїна: ${f.countryCode || "будь-яка"}\nФормат: ${f.workFormat}\nДавність: ${f.postedWithinDays} дн.\nЗарплата: ${f.minSalaryUsd || "—"} USD\nДжерела: ${f.sources.join(", ")}`;
  }
  private help() {
    return "💼 <b>Vacancy Monitor</b>\n/search frontend, react — ключові слова\n/exclude senior, lead — виключення\n/country UA — країна\n/format any|remote|onsite\n/days 7 — давність\n/salary 1500 — мінімум USD\n/sources — джерела\n/source on|off workua\n/filters — налаштування\n/scan — перевірити зараз\n/status — стан\n/help — довідка";
  }
  stop() { this.stopped = true; }
}
