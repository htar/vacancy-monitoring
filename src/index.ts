import { loadEnv, DEFAULT_FILTERS } from "./config.js";
import { Store } from "./database.js";
import { TelegramBot } from "./bot.js";
import { scan, flush } from "./scanner.js";

const env = loadEnv();
const store = new Store(env.DATABASE_PATH);
const filters = { ...DEFAULT_FILTERS, ...store.loadFilters() };
let scanning: Promise<Awaited<ReturnType<typeof scan>>> | undefined;
let bot: TelegramBot;
let firstRun = store.getSetting("baseline_created") !== "true";

async function monitor() {
  if (scanning) return scanning;
  scanning = (async () => {
    const summary = await scan(store, filters);
    if (firstRun) {
      const baseline = store.markAllPendingNotified();
      store.setSetting("baseline_created", "true");
      firstRun = false;
      await bot.sendText(`✅ Vacancy Monitor запущено. Створено baseline із ${baseline} поточних вакансій; надалі надсилатиму лише нові.`);
      console.log(JSON.stringify({ ...summary, baseline, at: new Date().toISOString() }));
      return summary;
    }
    const delivered = await flush(store, (v) => bot.sendVacancy(v));
    console.log(JSON.stringify({ ...summary, ...delivered, at: new Date().toISOString() }));
    return summary;
  })().finally(() => { scanning = undefined; });
  return scanning;
}

bot = new TelegramBot(env.BOT_TOKEN, env.BOT_CHAT_ID, async () => {
  return monitor();
});

void bot.run(store, filters);
void monitor();
const timer = setInterval(() => void monitor(), env.POLL_INTERVAL_MIN * 60_000);
const queueTimer = setInterval(() => { if (!scanning) void flush(store, (v) => bot.sendVacancy(v)); }, 10_000);

async function shutdown() {
  clearInterval(timer); clearInterval(queueTimer); bot.stop();
  await scanning; store.close(); process.exit(0);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
console.log(`Vacancy Monitor started; interval ${env.POLL_INTERVAL_MIN} min`);
