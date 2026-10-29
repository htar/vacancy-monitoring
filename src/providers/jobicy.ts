import * as cheerio from "cheerio";
import type { Vacancy } from "../types.js";

export async function fetchJobicyVacancies({ search, countryCode }: { search: string; countryCode: string }): Promise<Vacancy[]> {
  const params = new URLSearchParams({ count: "50", geo: countryCode ? "europe" : "europe" });
  if (search) params.set("tag", search);
  const response = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Jobicy HTTP ${response.status}`);
  const data = await response.json() as any;
  return (Array.isArray(data.jobs) ? data.jobs : []).map((job: any): Vacancy => ({
    id: `jobicy-${job.id}`, title: String(job.jobTitle ?? "Вакансія"), company: String(job.companyName ?? "Компанія"),
    location: String(job.jobGeo ?? "Europe"), countryCode: "", description: cheerio.load(String(job.jobDescription ?? "")).text().slice(0, 600),
    tags: Array.isArray(job.jobIndustry) ? job.jobIndustry : [job.jobIndustry].filter(Boolean),
    salaryFrom: Number(job.annualSalaryMin) || undefined, salaryTo: Number(job.annualSalaryMax) || undefined,
    currency: job.salaryCurrency || undefined, employmentType: "full-time", remote: true,
    postedAt: job.pubDate ?? new Date().toISOString(), source: "jobicy", url: job.url
  }));
}
