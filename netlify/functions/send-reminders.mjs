// Runs every minute. Sends:
//  - the daily "what time are you up tomorrow?" reminder at each subscriber's chosen local time
//  - a "start winding down" nudge at the wind-down time worked out in the app
import webpush from 'web-push';
import { subscriptionsStore, localParts, timeToMinutes } from '../lib/shared.mjs';

export const config = { schedule: '* * * * *' };

var MINUTE = 60000;
var HOUR = 60 * MINUTE;

async function send(record, payload) {
	try {
		await webpush.sendNotification(record.subscription, JSON.stringify(payload), { TTL: 3600 });
		return 'sent';
	} catch (error) {
		// 404/410 = the browser has thrown this subscription away.
		if (error.statusCode === 404 || error.statusCode === 410) return 'gone';
		console.error('Push failed', error.statusCode, error.body);
		return 'failed';
	}
}

export default async function handler() {
	var publicKey = process.env.PUBLIC_VAPID_KEY;
	var privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) {
		console.error('PUBLIC_VAPID_KEY / VAPID_PRIVATE_KEY are not set');
		return;
	}
	webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:you@example.com', publicKey, privateKey);

	var store = subscriptionsStore();
	var now = new Date();
	var listing = await store.list();

	for (var i = 0; i < listing.blobs.length; i++) {
		var key = listing.blobs[i].key;
		var record = await store.get(key, { type: 'json' });
		if (!record || !record.subscription) continue;

		var changed = false;
		var gone = false;

		// Wind-down nudge (skip it if we're more than 30 minutes late).
		if (record.windDownAt && !record.windDownSent) {
			var windDownAt = Date.parse(record.windDownAt);
			if (now.getTime() >= windDownAt) {
				if (now.getTime() - windDownAt < 30 * MINUTE) {
					var result = await send(record, {
						title: 'Start winding down',
						body: record.windDownBody,
						url: '/',
						tag: 'wind-down'
					});
					gone = result === 'gone';
				}
				record.windDownSent = true;
				changed = true;
			}
		}

		// Daily reminder, once per local day, within an hour of the chosen time.
		if (!gone && record.reminderTime) {
			var local = localParts(now, record.timeZone || 'Europe/Dublin');
			var target = timeToMinutes(record.reminderTime);

			if (record.lastReminderDate !== local.dateKey && local.minutes >= target && local.minutes < target + 60) {
				var reminderResult = await send(record, {
					title: 'What time are you up tomorrow?',
					body: 'Tap to work out your bedtime.',
					url: '/?from=reminder',
					tag: 'daily-reminder'
				});
				gone = reminderResult === 'gone';
				record.lastReminderDate = local.dateKey;
				changed = true;
			}
		}

		if (gone) {
			await store.delete(key);
		} else if (changed) {
			await store.setJSON(key, record);
		}
	}
}
