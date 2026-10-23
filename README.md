# When to go to bed

A tiny PWA: tell it what time you're getting up, it tells you when to wind down and when to be asleep.
It sends you a reminder at 8pm every day in your local time (it follows you if you change time zone), plus a "start winding down" nudge. Works offline once it has loaded.

## How it fits together

- `src/pages/index.astro`: the whole app (plain HTML and one inline script). It saves your last answers in `localStorage`.
- `public/sw.js`: the service worker. It caches the app for offline use and shows the push notifications.
- `netlify/functions/subscription.mjs`: `PUT/DELETE /api/subscription`. It stores your push subscription, reminder time and time zone in Netlify Blobs.
- `netlify/functions/send-reminders.mjs`: a scheduled function that runs every 5 minutes and sends the daily reminder and the wind-down nudge.

Browsers can't schedule notifications for a set time by themselves, so the scheduled function does the timing and sends real Web Push.

## Setup

1. `npm install`
2. VAPID keys are in `.env`, which is gitignored. To make new ones, run `npx web-push generate-vapid-keys`.
3. In Netlify → Site configuration → Environment variables, add these with scope **Builds + Functions**:
   - `PUBLIC_VAPID_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`: a `mailto:` address or your site URL
4. Deploy. Netlify Blobs needs no setup.

## Local dev

- `npm run dev` runs the UI only. `/api` isn't available, so turning on reminders will fail.
- `npx netlify dev` runs the UI plus the functions. You can trigger the scheduled function with `npx netlify functions:invoke send-reminders`.

## iPhone

Web Push only works once the app is added to the Home Screen (Share → Add to Home Screen) and opened from there.
