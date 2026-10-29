import "dotenv/config";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("Додайте BOT_TOKEN у .env");
const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await response.json() as any;
if (!data.ok) throw new Error(data.description ?? "Bot API error");
const chats = new Map<string, string>();
for (const update of data.result) {
  const chat = update.message?.chat ?? update.callback_query?.message?.chat;
  if (chat?.id) chats.set(String(chat.id), [chat.first_name, chat.username && `@${chat.username}`].filter(Boolean).join(" "));
}
if (!chats.size) console.log("Надішліть боту /start і повторіть: npm run chat-id");
for (const [id, name] of chats) console.log(`BOT_CHAT_ID=${id}  # ${name}`);
