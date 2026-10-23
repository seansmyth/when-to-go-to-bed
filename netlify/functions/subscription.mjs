// PUT    /api/subscription  { subscription, reminderTime, timeZone }  -> save / update reminder
// PUT    /api/subscription  { endpoint, windDownAt, windDownBody }    -> tonight's wind-down nudge
// POST   /api/subscription  { endpoint }                              -> send a test notification now
// DELETE /api/subscription  { endpoint }                              -> stop everything
import webpush from 'web-push';
import { subscriptionsStore, keyFor, isValidTimeZone } from '../lib/shared.mjs';

export const config = { path: '/api/subscription' };

function json(body, status) {
	return new Response(JSON.stringify(body), {
		status: status || 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

export default async function handler(request) {
	var body;
	try {
		body = await request.json();
	} catch (e) {
		return json({ error: 'Invalid JSON' }, 400);
	}

	var endpoint = body.subscription ? body.subscription.endpoint : body.endpoint;
	if (typeof endpoint !== 'string' || endpoint.indexOf('https://') !== 0) {
		return json({ error: 'Missing push endpoint' }, 400);
	}

	var store = subscriptionsStore();
	var key = keyFor(endpoint);

	if (request.method === 'DELETE') {
		await store.delete(key);
		return json({ ok: true });
	}

	if (request.method === 'POST') {
		var saved = await store.get(key, { type: 'json' });
		if (!saved || !saved.subscription) return json({ error: 'Subscription not saved on the server. Turn reminders off and on again.' }, 404);
		if (!process.env.PUBLIC_VAPID_KEY || !process.env.VAPID_PRIVATE_KEY) {
			return json({ error: 'PUBLIC_VAPID_KEY / VAPID_PRIVATE_KEY are not set for Functions in Netlify.' }, 500);
		}
		try {
			webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:you@example.com', process.env.PUBLIC_VAPID_KEY, process.env.VAPID_PRIVATE_KEY);
			await webpush.sendNotification(saved.subscription, JSON.stringify({
				title: 'Test notification',
				body: 'Reminder at ' + saved.reminderTime + ' (' + saved.timeZone + '). Push is working.',
				url: '/?from=reminder',
				tag: 'test'
			}), { TTL: 600 });
		} catch (error) {
			return json({ error: 'Push failed: ' + (error.statusCode || '') + ' ' + (error.body || error.message) }, 502);
		}
		return json({ ok: true, reminderTime: saved.reminderTime, timeZone: saved.timeZone });
	}

	if (request.method !== 'PUT') {
		return json({ error: 'Method not allowed' }, 405);
	}

	var record = (await store.get(key, { type: 'json' })) || {};

	if (body.subscription) {
		if (!body.subscription.keys || !body.subscription.keys.p256dh || !body.subscription.keys.auth) {
			return json({ error: 'Invalid subscription' }, 400);
		}
		record.subscription = body.subscription;
	}

	if (!record.subscription) {
		return json({ error: 'Unknown subscription' }, 404);
	}

	if (body.reminderTime !== undefined) {
		if (!/^\d{2}:\d{2}$/.test(body.reminderTime)) return json({ error: 'Invalid reminderTime' }, 400);
		// A new time counts as a fresh reminder, even if one already went out today.
		if (record.reminderTime !== body.reminderTime) delete record.lastReminderDate;
		record.reminderTime = body.reminderTime;
	}

	if (body.timeZone !== undefined) {
		if (!isValidTimeZone(body.timeZone)) return json({ error: 'Invalid timeZone' }, 400);
		record.timeZone = body.timeZone;
	}

	if (body.windDownAt !== undefined) {
		if (body.windDownAt !== null && isNaN(Date.parse(body.windDownAt))) return json({ error: 'Invalid windDownAt' }, 400);
		record.windDownAt = body.windDownAt;
		record.windDownBody = String(body.windDownBody || '').slice(0, 200);
		record.windDownSent = false;
		record.planSetAt = new Date().toISOString();
	}

	record.updatedAt = new Date().toISOString();
	await store.setJSON(key, record);
	return json({ ok: true });
}
