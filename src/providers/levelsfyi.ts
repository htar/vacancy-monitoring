import * as cheerio from 'cheerio';
import type { EmploymentType, Vacancy } from '../types.js';
import { countryCodeToEnglishName, fetchHtml, guessCountryCode, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

interface LevelsFyiJob {
  id: string;
  title: string;
  locations: string[];
  applicationUrl: string;
  postingDate?: string;
  minBaseSalary?: number | null;
  maxBaseSalary?: number | null;
  baseSalaryCurrency?: string | null;
  minTotalSalary?: number | null;
  maxTotalSalary?: number | null;
}

interface LevelsFyiCompany {
  companyName: string;
  jobs: LevelsFyiJob[];
}

function buildUrl(search: string, countryCode: string): string {
  const params = new URLSearchParams({ sortBy: 'date_published' });
  if (search) params.set('searchText', search);

  const englishCountryName = countryCode ? countryCodeToEnglishName(countryCode) : undefined;
  const locationSlug = englishCountryName?.replace(/\s+/g, '-');

  if (locationSlug) {
    params.set('locationSlug', locationSlug);
    return `https://www.levels.fyi/jobs/title/software-engineer/location/${locationSlug}?${params.toString()}`;
  }

  return `https://www.levels.fyi/jobs/title/software-engineer?${params.toString()}`;
}

const employmentType: EmploymentType = 'full-time';

/**
 * Levels.fyi — глобальна дошка вакансій розробників із фокусом на зарплату. Пошук і
 * фільтр за країною реально працюють на сервері (перевірено), дані вбудовані в
 * Next.js __NEXT_DATA__ на сторінці — не потрібен окремий API-ключ.
 */
export async function fetchLevelsFyiVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  const html = await fetchHtml(buildUrl(search, countryCode));
  if (!html) return [];

  const $ = cheerio.load(html);
  const rawData = $('#__NEXT_DATA__').html();
  if (!rawData) return [];

  let companies: LevelsFyiCompany[];
  try {
    const parsed = JSON.parse(rawData);
    companies = parsed?.props?.pageProps?.initialJobsData?.results ?? [];
  } catch {
    return [];
  }

  const vacancies: Vacancy[] = [];

  for (const company of companies) {
    for (const job of company.jobs ?? []) {
      if (!job.applicationUrl || !job.title) continue;

      const location = truncate(job.locations?.join(', ') ?? '', 160) || 'Не вказано';
      const jobCountryCode = guessCountryCode(job.locations?.[0]) || countryCode || '';
      const salaryFrom = job.minBaseSalary ?? job.minTotalSalary ?? undefined;
      const salaryTo = job.maxBaseSalary ?? job.maxTotalSalary ?? undefined;

      vacancies.push({
        id: `levelsfyi-${job.id}`,
        title: truncate(job.title, 200),
        company: truncate(company.companyName, 120) || 'Компанія не вказана',
        location,
        countryCode: jobCountryCode,
        description: 'Повний опис вакансії доступний за посиланням на роботодавця.',
        tags: [],
        salaryFrom: salaryFrom ?? undefined,
        salaryTo: salaryTo ?? undefined,
        currency: job.baseSalaryCurrency ?? undefined,
        employmentType,
        // Вакансія, відкрита одразу в десятках країн — типова ознака "hire anywhere" / remote.
        remote: (job.locations?.length ?? 0) > 3,
        postedAt: job.postingDate ?? new Date().toISOString(),
        source: 'levelsfyi',
        url: job.applicationUrl,
      });
    }
  }

  return vacancies;
}
