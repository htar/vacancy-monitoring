import type { ReportStats } from "./database.js";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const number = (n: number) => n.toLocaleString("uk-UA");
const pad = (n: number) => String(n).padStart(2, "0");

/** Дата за локальним часом у форматі YYYY-MM-DD. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Попередній календарний день (за місцевим часом) у форматі YYYY-MM-DD. */
export function previousDate(d: Date): string {
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

/** Звіт потрібен, коли настала година звіту, а сьогодні його ще не надсилали. */
export function isReportDue(now: Date, hour: number, lastReportDate: string | undefined): boolean {
  return now.getHours() >= hour && lastReportDate !== localDate(now);
}

export function formatReport(stats: ReportStats, title: string): string {
  const lines = [
    `🗓 <b>${escape(title)}</b>`,
    `Переглянуто: ${number(stats.seen)}`,
    `Збігів: ${number(stats.matched)}`,
    `Надіслано: ${number(stats.sent)}`
  ];
  if (stats.avgSalaryUsd !== undefined)
    lines.push(`Середня зарплата збігів: ${number(stats.avgSalaryUsd)} USD (вказана в ${stats.withSalary} з ${stats.matched})`);
  if (stats.topReasons.length) {
    lines.push("", "Найчастіше відхилялись:");
    for (const { reason, count } of stats.topReasons) lines.push(`• ${escape(reason)} (${number(count)})`);
  }
  return lines.join("\n");
}
