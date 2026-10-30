import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Vacancy } from "./types.js";
import type { SearchFilters } from "./search.js";
import { salaryUsd } from "./search.js";
import { localDate } from "./report.js";

export interface ReportStats {
  day: string;
  seen: number;
  matched: number;
  sent: number;
  avgSalaryUsd?: number;
  withSalary: number;
  topReasons: Array<{ reason: string; count: number }>;
}

export class Store {
  private readonly db: Database.Database;
  constructor(path: string) {
    const absolute = resolve(path);
    mkdirSync(dirname(absolute), { recursive: true });
    this.db = new Database(absolute);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vacancies (
        id TEXT NOT NULL, source TEXT NOT NULL, url TEXT NOT NULL, payload TEXT NOT NULL,
        first_seen_at TEXT NOT NULL, notified_at TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT, last_error TEXT, PRIMARY KEY(id, source)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS saved_vacancies (
        id TEXT NOT NULL, source TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY(id, source)
      );
      CREATE TABLE IF NOT EXISTS seen_log (
        day TEXT NOT NULL, id TEXT NOT NULL, source TEXT NOT NULL, seen_at TEXT NOT NULL,
        matched INTEGER NOT NULL, reason TEXT, salary_usd REAL, sent INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(day, id, source)
      );
    `);
  }

  saveVacancy(v: Vacancy): boolean {
    return this.db.prepare(`INSERT OR IGNORE INTO vacancies
      (id, source, url, payload, first_seen_at) VALUES (?, ?, ?, ?, ?)`)
      .run(v.id, v.source, v.url, JSON.stringify(v), new Date().toISOString()).changes === 1;
  }

  pending(limit = 100): Vacancy[] {
    const rows = this.db.prepare(`SELECT payload FROM vacancies WHERE notified_at IS NULL
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY first_seen_at LIMIT ?`)
      .all(new Date().toISOString(), limit) as Array<{ payload: string }>;
    return rows.flatMap((row) => { try { return [JSON.parse(row.payload) as Vacancy]; } catch { return []; } });
  }

  markNotified(v: Vacancy): void {
    this.db.prepare(`UPDATE vacancies SET notified_at = ?, retry_count = 0, next_attempt_at = NULL, last_error = NULL
      WHERE id = ? AND source = ?`).run(new Date().toISOString(), v.id, v.source);
    this.db.prepare(`INSERT INTO seen_log (day, id, source, seen_at, matched, salary_usd, sent)
      VALUES (?, ?, ?, ?, 1, ?, 1) ON CONFLICT(day, id, source) DO UPDATE SET sent = 1`)
      .run(localDate(new Date()), v.id, v.source, new Date().toISOString(), salaryUsd(v) ?? null);
  }

  /** Фіксує, що вакансію переглянуто сьогодні (за місцевим часом); reason — чому відхилено. */
  recordSeen(v: Vacancy, reason: string | undefined, now = new Date()): void {
    this.db.prepare(`INSERT INTO seen_log (day, id, source, seen_at, matched, reason, salary_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day, id, source)
      DO UPDATE SET matched = excluded.matched, reason = excluded.reason, salary_usd = excluded.salary_usd`)
      .run(localDate(now), v.id, v.source, now.toISOString(), reason ? 0 : 1, reason ?? null, salaryUsd(v) ?? null);
  }

  /** Статистика за календарний день у форматі YYYY-MM-DD. */
  reportStats(day: string): ReportStats {
    const totals = this.db.prepare(`SELECT COUNT(*) seen, COALESCE(SUM(matched), 0) matched, COALESCE(SUM(sent), 0) sent,
      AVG(CASE WHEN matched = 1 THEN salary_usd END) avg_salary,
      COUNT(CASE WHEN matched = 1 THEN salary_usd END) with_salary FROM seen_log WHERE day = ?`)
      .get(day) as { seen: number; matched: number; sent: number; avg_salary: number | null; with_salary: number };
    const topReasons = this.db.prepare(`SELECT reason, COUNT(*) count FROM seen_log
      WHERE day = ? AND matched = 0 AND reason IS NOT NULL GROUP BY reason ORDER BY count DESC, reason LIMIT 3`)
      .all(day) as Array<{ reason: string; count: number }>;
    return { day, seen: totals.seen, matched: totals.matched, sent: totals.sent,
      avgSalaryUsd: totals.avg_salary === null ? undefined : Math.round(totals.avg_salary),
      withSalary: totals.with_salary, topReasons };
  }

  /** Прибирає журнал переглядів, старший за 14 днів. */
  pruneSeenLog(now = new Date()): void {
    this.db.prepare("DELETE FROM seen_log WHERE seen_at < ?").run(new Date(now.getTime() - 14 * 86_400_000).toISOString());
  }

  markAllPendingNotified(): number {
    return this.db.prepare("UPDATE vacancies SET notified_at = ? WHERE notified_at IS NULL")
      .run(new Date().toISOString()).changes;
  }

  markFailed(v: Vacancy, error: unknown, now = new Date()): void {
    const row = this.db.prepare("SELECT retry_count FROM vacancies WHERE id = ? AND source = ?")
      .get(v.id, v.source) as { retry_count: number } | undefined;
    const retry = (row?.retry_count ?? 0) + 1;
    const delays = [10_000, 60_000, 300_000, 1_800_000];
    const next = new Date(now.getTime() + delays[Math.min(retry - 1, delays.length - 1)]!).toISOString();
    this.db.prepare(`UPDATE vacancies SET retry_count = ?, next_attempt_at = ?, last_error = ?
      WHERE id = ? AND source = ?`).run(retry, next, error instanceof Error ? error.message : String(error), v.id, v.source);
  }

  saveFavorite(v: Vacancy): boolean {
    return this.db.prepare("INSERT OR IGNORE INTO saved_vacancies (id, source, saved_at) VALUES (?, ?, ?)")
      .run(v.id, v.source, new Date().toISOString()).changes === 1;
  }

  stats() {
    return this.db.prepare(`SELECT COUNT(*) processed,
      COALESCE(SUM(notified_at IS NOT NULL), 0) notified,
      COALESCE(SUM(notified_at IS NULL), 0) pending FROM vacancies`).get() as
      { processed: number; notified: number; pending: number };
  }

  loadFilters(): SearchFilters | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'filters'").get() as { value: string } | undefined;
    try { return row ? JSON.parse(row.value) as SearchFilters : undefined; } catch { return undefined; }
  }
  getSetting(key: string): string | undefined {
    return (this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
  }
  setSetting(key: string, value: string): void {
    this.db.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(key, value, new Date().toISOString());
  }
  saveFilters(filters: SearchFilters): void {
    this.db.prepare(`INSERT INTO settings(key,value,updated_at) VALUES('filters',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(JSON.stringify(filters), new Date().toISOString());
  }
  close(): void { this.db.close(); }
}
