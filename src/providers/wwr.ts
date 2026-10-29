import * as cheerio from "cheerio";
import type { Vacancy } from "../types.js";

export async function fetchWwrVacancies({ search }: { search: string; countryCode: string }): Promise<Vacancy[]> {
  const response = await fetch("https://weworkremotely.com/remote-jobs.rss", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`WWR HTTP ${response.status}`);
  const $ = cheerio.load(await response.text(), { xmlMode: true });
  const vacancies: Vacancy[] = [];
  const needle = search.toLowerCase();
  $("item").each((_, item) => {
    const node = $(item); const titleText = node.find("title").text();
    const [company, ...titleParts] = titleText.split(":"); const title = titleParts.join(":").trim() || titleText;
    const description = cheerio.load(node.find("description").text()).text().slice(0, 600);
    if (needle && !`${title} ${description}`.toLowerCase().includes(needle)) return;
    const url = node.find("link").text();
    vacancies.push({ id: `wwr-${Buffer.from(url).toString("base64url").slice(0, 80)}`, title, company: company?.trim() || "Компанія",
      location: node.find("region").text() || node.find("country").text() || "Remote", countryCode: "", description,
      tags: [node.find("category").text()].filter(Boolean), employmentType: "full-time", remote: true,
      postedAt: node.find("pubDate").text() ? new Date(node.find("pubDate").text()).toISOString() : new Date().toISOString(),
      source: "wwr", url });
  });
  return vacancies;
}
