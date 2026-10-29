import * as cheerio from "cheerio";
import type { Vacancy } from "../types.js";
import { guessCountryCode } from "./utils.js";

export async function fetchArbeitnowVacancies({ search, countryCode }: { search: string; countryCode: string }): Promise<Vacancy[]> {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Arbeitnow HTTP ${response.status}`);
  const data = await response.json() as any;
  const needle = search.toLowerCase();
  return (Array.isArray(data.data) ? data.data : []).flatMap((job: any): Vacancy[] => {
    const text = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();
    const code = guessCountryCode(job.location) || (String(job.location).toLowerCase().includes("germany") ? "DE" : "");
    if ((needle && !text.includes(needle)) || (countryCode && code && code !== countryCode)) return [];
    return [{ id: `arbeitnow-${job.slug}`, title: String(job.title), company: String(job.company_name ?? "Компанія"),
      location: String(job.location ?? "Europe"), countryCode: code, description: cheerio.load(String(job.description ?? "")).text().slice(0, 600),
      tags: Array.isArray(job.tags) ? job.tags : [], employmentType: "full-time", remote: Boolean(job.remote),
      postedAt: job.created_at ? new Date(Number(job.created_at) * 1000).toISOString() : new Date().toISOString(),
      source: "arbeitnow", url: job.url }];
  });
}
