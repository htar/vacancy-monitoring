import * as cheerio from 'cheerio';
import type { EmploymentType, Vacancy } from '../types.js';
import { fetchHtml, guessCountryCode, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

interface DjinniJobPosting {
  title: string;
  url: string;
  description: string;
  datePosted: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string };
  jobLocation?: {
    address?: {
      addressCountry?: string | null;
      addressLocality?: string[] | string | null;
    };
  };
}

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  CONTRACTOR: 'contract',
  TEMPORARY: 'contract',
  INTERN: 'internship',
};

function mapEmploymentType(value?: string | string[]): EmploymentType {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw && EMPLOYMENT_TYPE_MAP[raw]) || 'full-time';
}

function extractLocation(job: DjinniJobPosting): string {
  const locality = job.jobLocation?.address?.addressLocality;
  const localityText = Array.isArray(locality) ? locality.join(', ') : locality;
  const country = job.jobLocation?.address?.addressCountry;
  return truncate([localityText, country].filter(Boolean).join(', '), 120) || 'Віддалено';
}

/** Djinni публікує кожну вакансію як schema.org/JobPosting у JSON-LD — це надійніше за CSS-селектори. */
export async function fetchDjinniVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  const url = `https://djinni.co/jobs/?all_keywords=${encodeURIComponent(search)}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const scriptContent = $('script[type="application/ld+json"]').first().html();
  if (!scriptContent) return [];

  let jobs: DjinniJobPosting[];
  try {
    const parsed = JSON.parse(scriptContent);
    jobs = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }

  return jobs
    .filter((job) => job?.url && job?.title)
    .map((job) => {
      const location = extractLocation(job);
      const jobCountryCode = guessCountryCode(job.jobLocation?.address?.addressCountry) || 'UA';

      return {
        id: `djinni-${job.url.match(/\/jobs\/(\d+)/)?.[1] ?? job.url}`,
        title: truncate(job.title, 200),
        company: truncate(job.hiringOrganization?.name ?? 'Компанія не вказана', 120),
        location,
        countryCode: jobCountryCode,
        description: truncate(job.description, 320),
        tags: [],
        employmentType: mapEmploymentType(job.employmentType),
        remote: /worldwide|remote|віддалено|весь світ/i.test(location),
        postedAt: job.datePosted ?? new Date().toISOString(),
        source: 'djinni' as const,
        url: job.url,
      };
    })
    .filter((vacancy) => !countryCode || !vacancy.countryCode || vacancy.countryCode === countryCode);
}
