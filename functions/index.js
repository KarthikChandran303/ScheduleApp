const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// EDIT THIS to your group's timezone (IANA name), e.g. 'Asia/Kolkata'.
const TIMEZONE = 'Asia/Kolkata';

// Send a push this many minutes before an activity starts.
const LEAD_MINUTES = 20;
// How wide a window each 5-minute run checks, to avoid gaps/dupes if a run
// is slightly delayed. Should be >= the schedule interval below.
const WINDOW_MINUTES = 6;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nowInTimezone() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    day: map.weekday, // "Mon", "Tue", ...
    dateKey: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Runs every 5 minutes. See https://firebase.google.com/docs/functions/schedule-functions
exports.sendUpcomingActivityPushes = onSchedule(
  { schedule: 'every 5 minutes', timeZone: TIMEZONE },
  async () => {
    const { day, dateKey, minutes: nowMinutes } = nowInTimezone();

    const snap = await db.collection('activities').where('day', '==', day).get();
    if (snap.empty) return;

    const usersSnap = await db.collection('users').get();
    const usersById = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]));

    for (const activityDoc of snap.docs) {
      const activity = activityDoc.data();
      const startMinutes = toMinutes(activity.startTime);
      const minutesUntilStart = startMinutes - nowMinutes;

      const alreadyNotified = activity.notifiedForDate === dateKey;
      const inWindow =
        minutesUntilStart <= LEAD_MINUTES && minutesUntilStart > LEAD_MINUTES - WINDOW_MINUTES;

      if (!inWindow || alreadyNotified) continue;

      const tokens = (activity.assignedTo || [])
        .map((uid) => usersById[uid]?.fcmToken)
        .filter(Boolean);

      if (tokens.length > 0) {
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: {
            title: activity.title,
            body: `Starts at ${activity.startTime}${
              activity.assignedTo?.length > 1 ? ' — you\'re assigned with others' : ''
            }`,
          },
          data: { activityId: activityDoc.id },
        });
      }

      await activityDoc.ref.update({
        notifiedForDate: dateKey,
        lastNotifiedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
