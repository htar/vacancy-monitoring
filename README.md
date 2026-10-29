# Vacancy Monitor Telegram Bot

Автономний Telegram-бот для пошуку нових вакансій. Джерела та адаптери перенесені з `htar/vacancy-search-app`: Work.ua, DOU, Djinni, LinkedIn, BeBee, Levels.fyi та Greenhouse.

## Можливості

- опитування джерел паралельно кожні 15 хвилин;
- SQLite-дедуплікація та надійна черга повторної доставки;
- фільтри змінюються без перезапуску й зберігаються в SQLite;
- збій одного джерела не зупиняє решту;
- ручний `/scan`, `/status` і `/health`;
- працює на Windows, Linux, macOS і в Docker.

## Налаштування

```powershell
Copy-Item .env.example .env
npm install
```

У `.env` спочатку заповніть `BOT_TOKEN`. Бота створюють через `@BotFather`; надішліть йому `/start`, а потім отримайте ID:

```powershell
npm run chat-id
```

Скопіюйте показаний `BOT_CHAT_ID=...` у `.env`.

```powershell
npm start
```

## Команди

```text
/search frontend, react, typescript
/exclude senior, lead
/country UA
/country off
/format any
/format remote
/format onsite
/days 7
/salary 1500
/salary off
/sources
/source on workua
/source off linkedin
/filters
/scan
/status
/health
/help
```

Налаштування за замовчуванням шукають `frontend`, `react`, `typescript` в Україні за останні 7 днів. Змініть їх командами під свою спеціальність.

## Перевірки

```powershell
npm run typecheck
npm test
```

## Docker

```bash
docker compose up -d --build
```

Бот працює тільки з публічно доступними сторінками, не обходить CAPTCHA, авторизацію чи антибот-захист. Розмітка сайтів може змінюватися, тому стан джерел варто регулярно контролювати через логи.
