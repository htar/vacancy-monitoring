# Vacancy Monitor Telegram Bot

Автономний Telegram-бот для пошуку нових вакансій. Джерела: Work.ua, DOU, Djinni, LinkedIn, BeBee, Levels.fyi, Greenhouse, Jobicy, Arbeitnow, Remote OK, We Work Remotely та публічні Telegram-канали.

## Можливості

- опитування джерел паралельно кожні 15 хвилин;
- SQLite-дедуплікація та надійна черга повторної доставки;
- фільтри змінюються без перезапуску й зберігаються в SQLite;
- збій одного джерела не зупиняє решту;
- Telegram listener через MTProto з backfill останніх 50 повідомлень кожного каналу;
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
/tgchannels
/tgchannel add @frontend_dou
/tgchannel remove @frontend_dou
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

## Автозапуск у Windows

Бот запускається при вході в Windows через Планувальник завдань (Task Scheduler). Завдання створюють один раз у PowerShell; шляхи підставте свої:

```powershell
$dir  = 'C:\шлях\до\vacancy-monitoring'
$node = (Get-Command node).Source
$user = "$env:USERDOMAIN\$env:USERNAME"

New-Item -ItemType Directory -Force "$dir\logs" | Out-Null
$arg       = '/c ""' + $node + '" node_modules\tsx\dist\cli.mjs src\index.ts >> logs\bot.log 2>&1"'
$action    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg -WorkingDirectory $dir
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = 'PT30S'
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'vacancy-monitoring' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
```

Що робить завдання: стартує через 30 секунд після входу (щоб піднялася мережа), працює в прихованому вікні без обмеження за часом, пише вивід у `logs\bot.log` і перезапускається щохвилини після збою. Якщо Node встановлено через nvm, `(Get-Command node).Source` вказує на стабільний symlink, тож зміна версії Node завдання не ламає.

Керування:

```powershell
Start-ScheduledTask   -TaskName vacancy-monitoring   # запустити зараз
Stop-ScheduledTask    -TaskName vacancy-monitoring   # зупинити
Disable-ScheduledTask -TaskName vacancy-monitoring   # вимкнути автозапуск
Unregister-ScheduledTask -TaskName vacancy-monitoring -Confirm:$false   # видалити
```

Не запускайте `npm start` у терміналі, поки завдання працює: два процеси з одним токеном конфліктують за `getUpdates` (помилка 409). Спершу `Stop-ScheduledTask`.

Логи дописуються у `logs\bot.log` (ротації немає; `*.log` у `.gitignore`):

```powershell
Get-Content logs\bot.log -Tail 50 -Wait   # стежити в реальному часі
```

Щоб очистити файл, зупиніть завдання й видаліть `logs\bot.log`. Після оновлення коду перезапустіть завдання (`Stop-ScheduledTask`, потім `Start-ScheduledTask`).

## Docker

```bash
docker compose up -d --build
```

Бот працює тільки з публічно доступними сторінками, не обходить CAPTCHA, авторизацію чи антибот-захист. Розмітка сайтів може змінюватися, тому стан джерел варто регулярно контролювати через логи.

## Telegram-канали

Для читання чужих публічних каналів Bot API недостатньо. Створіть application на `https://my.telegram.org/apps`, додайте `TG_API_ID` і `TG_API_HASH` у `.env`, потім:

```powershell
npm run session:qr
```

Скопіюйте отриманий `TG_SESSION` у `.env`. Без цих трьох значень API/RSS-моніторинг працює, а Telegram collector залишається вимкненим.

Каталог за замовчуванням включає українські DOU/IT/design канали та європейські remote/relocation канали. Повне дослідження з оцінкою джерел знаходиться в `docs/SOURCE_RESEARCH.md`.
