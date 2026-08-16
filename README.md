# Group Schedule

A React PWA + Firebase backend (Auth, Firestore, Cloud Messaging, Cloud Functions)
for coordinating a group's schedule, availability, and push reminders.

Live app: https://scheduling-app-3e0ea.web.app

## Prerequisites

- **Node.js** (v20+ recommended): https://nodejs.org
- **Firebase CLI**, for deploying:
  ```
  npm install -g firebase-tools
  firebase login
  ```
- Access to the `scheduling-app-3e0ea` Firebase project (ask an existing
  scheduler/admin to add your Google account as a project member if you need
  to deploy Firestore rules, Cloud Functions, or Hosting).

The Firebase web app config is already checked into the repo
(`src/lib/firebase.js` and `public/firebase-messaging-sw.js`, kept in sync
manually since service workers can't import app code) — no setup needed there
for local development.

## Local development

```
npm install
npm run dev
```

This starts a dev server (usually at http://localhost:5173) connected to the
live Firebase project. Sign up or sign in to try it out — new accounts start
as view-only (see below for becoming a scheduler), or use **Continue as
guest** to browse the public schedule with no account.

If you're also working on the Cloud Function (push notifications), install
its dependencies separately:
```
cd functions
npm install
cd ..
```

## Becoming a scheduler

New accounts start as `role: "unassigned"` (view-only) on purpose. Scheduler
access is now granted entirely within the app:

1. When signing up, choose **Request scheduler access** as your access level.
2. An existing scheduler opens the **Requests** page in the app and
   approves or denies the request.
3. Once approved, reload — you'll see the **+ New activity** button and
   full editing controls.

(No manual Firestore edits needed. The one exception is bootstrapping the
very first scheduler on a brand-new project with zero schedulers yet — in
that case, promote one user by hand in the Firestore console: `users`
collection → their document → set `role` to `scheduler`.)

## Deploying changes

Build and deploy the frontend:
```
npm run build
firebase deploy --only hosting
```

Deploy Firestore security rules after changing `firestore.rules`:
```
firebase deploy --only firestore:rules
```

Deploy the Cloud Function after changing `functions/index.js`:
```
firebase deploy --only functions
```
The function (`sendUpcomingActivityPushes`) runs every 5 minutes in the cloud
and pushes to assigned people's registered devices for activities starting
soon. Relevant settings in `functions/index.js`:
- `TIMEZONE` — IANA timezone used to determine "today" and "starting soon".
- `LEAD_MINUTES` — how many minutes ahead of an activity to notify.

Note: scheduled Cloud Functions require the Blaze (pay-as-you-go) plan, though
usage for a group this size should stay within the free monthly quota.

## Installing on phones and testing push

- **Android (Chrome)**: open the URL, tap the menu (⋮) → **Add to Home screen**.
- **iPhone (Safari, iOS 16.4+)**: open the URL, tap the Share icon → **Add to
  Home Screen**. Push notifications on iOS **only work once the app is added
  to the home screen and opened from there** — they won't work from Safari
  directly.
- Open the installed app, sign in, and accept the notification permission
  prompt when asked.
- As a scheduler, create an activity starting ~20 minutes out (matching
  `LEAD_MINUTES`) and assign yourself or a test phone. Wait for the push.

## Icons

Icons live at `public/icons/icon-192.png` and `icon-512.png`. Swap them for
your own artwork any time (same filenames/sizes) — no code changes needed.
