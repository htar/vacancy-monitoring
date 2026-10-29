import test from "node:test";
import assert from "node:assert/strict";
import { telegramPostToVacancy } from "../src/telegram.js";

test("normalizes Telegram vacancy posts and rejects candidate posts", () => {
  const vacancy = telegramPostToVacancy("jobs", { id: 7, date: 1_793_200_000,
    message: "🔥 Frontend Developer\nCompany: Acme\nLocation: Remote, Ukraine\nSalary: $2000–3000\nReact TypeScript" });
  assert.equal(vacancy?.title, "Frontend Developer");
  assert.equal(vacancy?.company, "Acme");
  assert.equal(vacancy?.countryCode, "UA");
  assert.equal(vacancy?.salaryFrom, 2000);
  assert.equal(vacancy?.salaryTo, 3000);
  assert.equal(vacancy?.remote, true);
  assert.equal(telegramPostToVacancy("jobs", { id: 8, date: 1, message: "Шукаю роботу Frontend Developer" }), undefined);
});
