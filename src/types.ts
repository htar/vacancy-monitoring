export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export type VacancySourceId =
  | 'djinni'
  | 'dou'
  | 'linkedin'
  | 'workua'
  | 'robotaua'
  | 'thejobtech'
  | 'bebee'
  | 'levelsfyi'
  | 'greenhouse'
  | 'nextraise'
  | 'glassdoor'
  | 'welcometothejungle'
  | 'climatebase'
  | 'mercor'
  | 'hirify'
  | 'consider';

export interface Vacancy {
  id: string;
  title: string;
  company: string;
  location: string;
  countryCode: string;
  description: string;
  tags: string[];
  salaryFrom?: number;
  salaryTo?: number;
  currency?: string;
  employmentType: EmploymentType;
  remote: boolean;
  postedAt: string;
  source: VacancySourceId;
  /** Посилання на оригінальне оголошення на сайті джерела */
  url: string;
}

export interface Country {
  code: string;
  name: string;
}

export type WorkFormat = 'any' | 'remote' | 'onsite';

export interface VacancyFilters {
  search?: string;
  countryCode?: string;
  sources?: VacancySourceId[];
  workFormat?: WorkFormat;
  /** Показувати лише вакансії, опубліковані за останні N днів. */
  postedWithinDays?: number;
  /** Мінімальна зарплата в приблизному еквіваленті USD. */
  minSalary?: number;
}
