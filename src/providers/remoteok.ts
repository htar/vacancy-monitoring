import * as cheerio from "cheerio";
import type { Vacancy } from "../types.js";

export async function fetchRemoteOkVacancies({ search }: { search: string; countryCode: string }): Promise<Vacancy[]> {
  const response = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "vacancy-monitoring/1.0 (+https://github.com/htar/vacancy-monitoring)" }, signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Remote OK HTTP ${response.status}`);
  const data = await response.json() as any[];
  const needle = search.toLowerCase();
  return data.slice(1).flatMap((job: any): Vacancy[] => {
    const text = `${job.position ?? ""} ${job.description ?? ""} ${(job.tags ?? []).join(" ")}`.toLowerCase();
    if (needle && !text.includes(needle)) return [];
    return [{ id: `remoteok-${job.id}`, title: String(job.position), company: String(job.company ?? "Компанія"),
      location: String(job.location ?? "Remote"), countryCode: "", description: cheerio.load(String(job.description ?? "")).text().slice(0, 600),
      tags: Array.isArray(job.tags) ? job.tags : [], salaryFrom: Number(job.salary_min) || undefined,
      salaryTo: Number(job.salary_max) || undefined, currency: "USD", employmentType: "full-time", remote: true,
      postedAt: job.date ?? new Date().toISOString(), source: "remoteok", url: job.url }];
  });
}
