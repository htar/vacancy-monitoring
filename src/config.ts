import "dotenv/config";
import { z } from "zod";
import type { SearchFilters } from "./search.js";

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_CHAT_ID: z.string().min(1),
  DATABASE_PATH: z.string().default("./data/vacancies.sqlite"),
  POLL_INTERVAL_MIN: z.coerce.number().min(1).default(15)
});

export const DEFAULT_FILTERS: SearchFilters = {
  search: ["frontend", "react", "typescript"],
  exclude: [],
  countryCode: "UA",
  workFormat: "any",
  postedWithinDays: 7,
  minSalaryUsd: 0,
  sources: ["workua", "dou", "djinni", "linkedin", "bebee", "levelsfyi", "greenhouse"]
};

export function loadEnv() { return schema.parse(process.env); }
