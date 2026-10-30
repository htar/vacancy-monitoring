import "dotenv/config";
import { z } from "zod";
import type { SearchFilters } from "./search.js";

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_CHAT_ID: z.string().min(1),
  DATABASE_PATH: z.string().default("./data/vacancies.sqlite"),
  POLL_INTERVAL_MIN: z.coerce.number().min(1).default(15),
  /** Година (0–23, за місцевим часом), о якій надсилати звіт за попередню добу. */
  DAILY_REPORT_HOUR: z.coerce.number().int().min(0).max(23).default(7),
  TG_API_ID: z.preprocess((v) => v === "" ? undefined : v, z.coerce.number().int().positive().optional()),
  TG_API_HASH: z.string().optional(),
  TG_SESSION: z.string().optional()
});

export const DEFAULT_FILTERS: SearchFilters = {
  search: ["frontend", "react", "typescript"],
  exclude: [],
  countryCode: "UA",
  workFormat: "any",
  postedWithinDays: 7,
  minSalaryUsd: 0,
  sources: ["workua", "dou", "djinni", "linkedin", "bebee", "levelsfyi", "greenhouse",
    "jobicy", "arbeitnow", "remoteok", "wwr"]
};

export const DEFAULT_TELEGRAM_CHANNELS = [
  "junior_dou_ua", "dou_qa", "frontend_dou", "devops_dou", "itexpert_vacancies", "casesjobs", "DesJobUa", "dna325",
  "relocateme", "jobs_abroad", "jobs_in_european_countries", "jobsineu", "remotejobs", "remotejobpositions", "talentservicejobs"
];

export function loadEnv() { return schema.parse(process.env); }
