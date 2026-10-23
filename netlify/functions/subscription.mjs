// PUT    /api/subscription  { subscription, reminderTime, timeZone }  -> save / update reminder
// PUT    /api/subscription  { endpoint, windDownAt, windDownBody }    -> tonight's wind-down nudge
// DELETE /api/subscription  { endpoint }                              -> stop everything
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
