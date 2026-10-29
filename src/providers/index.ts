import type { Vacancy } from "../types.js";
import type { SourceId } from "../search.js";
import { fetchWorkUaVacancies } from "./workua.js";
import { fetchDouVacancies } from "./dou.js";
import { fetchDjinniVacancies } from "./djinni.js";
import { fetchLinkedInVacancies } from "./linkedin.js";
import { fetchBebeeVacancies } from "./bebee.js";
import { fetchLevelsFyiVacancies } from "./levelsfyi.js";
import { fetchGreenhouseVacancies } from "./greenhouse.js";

const providers: Record<SourceId, (p: { search: string; countryCode: string }) => Promise<Vacancy[]>> = {
  workua: fetchWorkUaVacancies, dou: fetchDouVacancies, djinni: fetchDjinniVacancies,
  linkedin: fetchLinkedInVacancies, bebee: fetchBebeeVacancies,
  levelsfyi: fetchLevelsFyiVacancies, greenhouse: fetchGreenhouseVacancies
};

export async function fetchVacancies(sources: SourceId[], search: string, countryCode: string) {
  const settled = await Promise.allSettled(sources.map((source) => providers[source]({ search, countryCode })));
  const vacancies: Vacancy[] = [];
  const failed: SourceId[] = [];
  settled.forEach((result, index) => {
    const source = sources[index]!;
    if (result.status === "fulfilled") vacancies.push(...result.value);
    else failed.push(source);
  });
  const seen = new Set<string>();
  return { vacancies: vacancies.filter((v) => {
    const key = `${v.title.trim().toLowerCase()}::${v.company.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }), failed };
}
