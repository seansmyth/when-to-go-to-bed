import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export function subscriptionsStore() {
	return getStore({ name: 'subscriptions', consistency: 'strong' });
}

export function keyFor(endpoint) {
	return createHash('sha256').update(endpoint).digest('hex');
}

export function isValidTimeZone(timeZone) {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: timeZone });
		return true;
	} catch (e) {
		return false;
	}
}

// Local date ("2026-10-23") and minutes since midnight for a moment in a given time zone.
export function localParts(date, timeZone) {
	var parts = {};
	new Intl.DateTimeFormat('en-GB', {
		timeZone: timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	})
		.formatToParts(date)
		.forEach(function (part) {
			parts[part.type] = part.value;
		});

	return {
		dateKey: parts.year + '-' + parts.month + '-' + parts.day,
		minutes: Number(parts.hour) * 60 + Number(parts.minute)
	};
}

export function timeToMinutes(value) {
	var parts = value.split(':');
	return Number(parts[0]) * 60 + Number(parts[1]);
}
