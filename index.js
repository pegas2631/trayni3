import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import _ from 'lodash-es';
import axios from 'axios';
import schedule from 'node-schedule';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === база данных
const adapter = new JSONFile('db.json');
const defaultData = { subscriptions: [] };
const db = new Low(adapter, defaultData);

async function main() {
	await db.read();
	_.defaultsDeep(db.data, defaultData);
	await db.write();

	// === Telegram Bot Handlers
	bot.onText(/\/start/, (msg) => {
		bot.sendMessage(msg.chat.id, 'Открой WebApp для подписки:', {
			reply_markup: {
				keyboard: [[
					{
						text: '🚆111 Подписаться',
						web_app: {
							url: `https://tuna.am/${process.env.BOT_USERNAME}?startapp=${encodeURIComponent('https://tu23hw-103-54-18-136.ru.tuna.am/')}`
						}
					}
				]],
				resize_keyboard: true
			}
		});
	});

	bot.onText(/\/from (.+)/, async (msg, match) => {
		const from = match[1];
		const res = await axios.get(`https://suggests.rasp.yandex.net/all_suggests?format=json&part=${encodeURIComponent(from)}`);
		const stations = res.data.segments.map(s => s.title).slice(0, 5);
		bot.sendMessage(msg.chat.id, `Похожие станции:\n${stations.join('\n')}`);
	});

	bot.onText(/\/subscribe (.+)/, async (msg, match) => {
		const args = match[1].split(',');
		const [from, to, date, placeType] = args.map(s => s.trim());
		db.data.subscriptions.push({ chat_id: msg.chat.id, from, to, date, placeType });
		await db.write();
		bot.sendMessage(msg.chat.id, `Подписка оформлена: ${from} → ${to} на ${date} (${placeType})`);
	});

	app.post('/subscribe', async (req, res) => {
		const { chat_id, from, to, date, placeType } = req.body;
		db.data.subscriptions.push({ chat_id, from, to, date, placeType });
		await db.write();
		res.send({ status: 'ok' });
	});

	async function checkPlaces() {
		for (const sub of db.data.subscriptions) {
			const found = Math.random() < 0.3;
			if (found) {
				bot.sendMessage(sub.chat_id, `⚠️ Появились места ${sub.placeType} на поезд ${sub.from} → ${sub.to} (${sub.date})`);
			}
		}
	}

	schedule.scheduleJob('*/5 * * * *', checkPlaces);

	app.get('/', (req, res) => {
		res.sendFile(path.join(__dirname, 'public', 'index.html'));
	});

	app.listen(3000, () => {
		console.log('✅ WebApp running on http://localhost:3000');
	});
}

main();
