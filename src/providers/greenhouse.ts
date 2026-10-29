import type { Vacancy } from '../types.js';
import { fetchHtml, guessCountryCode, isGenericallyRemoteLabel, truncate } from './utils.js';

interface ProviderParams {
  search: string;
  countryCode: string;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
}

/**
 * Greenhouse — популярна ATS-платформа, але публічне API (boards-api.greenhouse.io)
 * віддає вакансії окремо по кожній компанії, без єдиного пошуку по всіх роботодавцях.
 * Тому беремо куратований список tech-компаній із публічними бордами й reputation
 * найму в Європі/віддалено, і фільтруємо результат уже на своєму боці за search-терміном.
 */
const CURATED_COMPANIES: { token: string; name: string }[] = [
  { token: 'gitlab', name: 'GitLab' },
  { token: 'elastic', name: 'Elastic' },
  { token: 'coinbase', name: 'Coinbase' },
  { token: 'affirm', name: 'Affirm' },
  { token: 'squarespace', name: 'Squarespace' },
  { token: 'webflow', name: 'Webflow' },
  { token: 'figma', name: 'Figma' },
  { token: 'asana', name: 'Asana' },
  { token: 'discord', name: 'Discord' },
  { token: 'pinterest', name: 'Pinterest' },
  { token: 'doximity', name: 'Doximity' },
];

async function fetchCompanyJobs(token: string): Promise<GreenhouseJob[] | null> {
  const raw = await fetchHtml(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data?.jobs) ? data.jobs : [];
  } catch {
    return null;
  }
}

export async function fetchGreenhouseVacancies({ search, countryCode }: ProviderParams): Promise<Vacancy[]> {
  const normalizedSearch = search.trim().toLowerCase();

  const perCompany = await Promise.all(
    CURATED_COMPANIES.map(async (company) => ({
      company,
      jobs: await fetchCompanyJobs(company.token),
    }))
  );

  const vacancies: Vacancy[] = [];

  for (const { company, jobs } of perCompany) {
    if (!jobs) continue;

    for (const job of jobs) {
      if (normalizedSearch && !job.title.toLowerCase().includes(normalizedSearch)) continue;

      const location = truncate(job.location?.name ?? '', 160) || 'Не вказано';
      const jobCountryCode = guessCountryCode(location);

      if (countryCode) {
        // Greenhouse не фільтрує по країні на сервері — робимо це самі. Якщо країну
        // конкретної вакансії не вдалось розпізнати (напр. "Remote - Singapore" чи
        // "Bangalore, India" — цих країн немає в нашій мапі), це НЕ "невідомо, отже
        // підходить" — інакше вакансії з будь-якої нерозпізнаної країни проходили б повз
        // будь-який фільтр країни. Пропускаємо без розпізнаної країни лише вакансії, де
        // локація ЦІЛКОМ загальна ("Remote"/"Worldwide", без жодної конкретної країни) —
        // важливо перевіряти саме весь рядок, а не наявність слова "remote" де-небудь:
        // "Remote - Singapore" це не "глобально відкрито", а прив'язка до Сінгапуру.
        if (jobCountryCode ? jobCountryCode !== countryCode : !isGenericallyRemoteLabel(location)) {
          continue;
        }
      }

      vacancies.push({
        id: `greenhouse-${company.token}-${job.id}`,
        title: truncate(job.title, 200),
        company: company.name,
        location,
        countryCode: jobCountryCode,
        description: 'Повний опис вакансії доступний на сторінці роботодавця.',
        tags: [],
        employmentType: 'full-time',
        remote: /remote|віддалено/i.test(location),
        postedAt: job.updated_at ?? new Date().toISOString(),
        source: 'greenhouse',
        url: job.absolute_url,
      });
    }
  }

  return vacancies;
}
