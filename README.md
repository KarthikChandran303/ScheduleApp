# Group Schedule — Setup Guide

This is the scaffolded app from the build brief: a React PWA + Firebase backend
(Auth, Firestore, Cloud Messaging, Cloud Functions). Follow these steps in order —
each one builds on the last. You'll use VS Code's integrated terminal for every
command below (menu: **Terminal > New Terminal**).

## 0. Install prerequisites (one-time, on your computer)

- **Node.js** (v24 LTS recommended): https://nodejs.org — download and run the installer.
- **VS Code**: https://code.visualstudio.com
- Open this `scheduling-app` folder in VS Code: **File > Open Folder…**

Check Node installed correctly:
```
node -v
npm -v
```
Both should print version numbers.

## 1. Install project dependencies

In the VS Code terminal, at the root of this folder:
```
npm install
```
Then also install the Cloud Functions dependencies:
```
cd functions
npm install
cd ..
```

## 2. Create the Firebase project

1. Go to https://console.firebase.google.com and click **Add project**. Name it
   anything (e.g. "group-schedule"). You can skip Google Analytics.
2. Once created, click the **</> (web)** icon to register a web app. Give it any
   nickname. Firebase will show you a `firebaseConfig` object — **copy it**, you'll
   need it in step 3.
3. In the left sidebar: **Build > Authentication > Get started** → enable
   **Email/Password** as a sign-in method.
4. **Build > Firestore Database > Create database** → start in **production mode**,
   pick a region close to your group.
5. **Build > Cloud Messaging** → note the tab exists; you'll generate a key in step 5.

## 3. Fill in your Firebase config (two files, must match)

Open these two files and replace every `REPLACE_ME` with the matching value from
the `firebaseConfig` object you copied in step 2:

- `src/lib/firebase.js`
- `public/firebase-messaging-sw.js`

(They're duplicated because service workers can't import app code — keep them in sync
if you ever change project.)

## 4. Generate a Web Push (VAPID) key

1. Firebase Console → **Project settings** (gear icon) → **Cloud Messaging** tab.
2. Under **Web configuration > Web Push certificates**, click **Generate key pair**.
3. Copy the key into `VAPID_KEY` in `src/lib/firebase.js`.

## 5. Install the Firebase CLI and log in

```
npm install -g firebase-tools
firebase login
```
This opens a browser window to sign in with the same Google account you used for
the Firebase console.

Then connect this folder to your project:
```
firebase use --add
```
Pick the project you created, and give it the alias `default` when prompted.

## 6. Run it locally

```
npm run dev
```
This starts a dev server (usually at http://localhost:5173). Open it in your
browser, sign up for an account — you'll land on an empty schedule as a
view-only user.

## 7. Make yourself a scheduler

New accounts start as `role: "unassigned"` (view-only) on purpose — see the
brief for why. To grant yourself (or anyone) scheduler access:
1. Firebase Console → **Firestore Database** → `users` collection.
2. Find your user document (matches your email/name).
3. Edit the `role` field from `unassigned` to `scheduler`.
4. Reload the app — you should now see the **+** button to add activities.

## 8. Deploy Firestore security rules and the Cloud Function

```
firebase deploy --only firestore:rules
firebase deploy --only functions
```
The function (`sendUpcomingActivityPushes`) runs every 5 minutes in the cloud once
deployed — it checks for activities starting soon and pushes to assigned people's
registered devices. Before deploying, open `functions/index.js` and set
`TIMEZONE` to your group's IANA timezone (e.g. `'Asia/Kolkata'`, already set as
the default — change if needed) — this determines "today" and "starting soon" for
notification timing. Also double-check `LEAD_MINUTES` (how early to notify).

Note: scheduled Cloud Functions require your Firebase project to be on the
**Blaze (pay-as-you-go)** plan — but the scheduler + function invocations for a
group this size will stay within the free monthly quota (Blaze still has a free
tier per month; you're billed only past it). Console will prompt you to upgrade
when you deploy if you haven't already.

## 9. Build and deploy the frontend

```
npm run build
firebase deploy --only hosting
```
This prints a live URL (something like `https://your-project.web.app`) — that's
what your group installs to their home screen.

## 10. Install on phones and test push

- **Android (Chrome)**: open the URL, tap the menu (⋮) → **Add to Home screen**.
- **iPhone (Safari, iOS 16.4+)**: open the URL, tap the Share icon → **Add to Home
  Screen**. Push notifications on iOS **only work once the app is added to the
  home screen and opened from there** — they won't work from Safari directly.
- Open the installed app, sign in, and accept the notification permission
  prompt when asked.
- As a scheduler, create an activity starting ~20 minutes out (matching
  `LEAD_MINUTES`) and assign yourself or a test phone. Wait for the push.

## Everyday use after setup

- You (as admin) promote new signups to `scheduler` in the Firestore console
  as needed (step 7) — everyone else stays view-only by default and can mark
  their own unavailability.
- Any time you change the code, repeat step 9 (`npm run build` +
  `firebase deploy --only hosting`) to push updates live.

## Icons

Placeholder icons are included at `public/icons/icon-192.png` and `icon-512.png`.
Swap them for your own artwork any time (same filenames/sizes) — no code changes
needed.
