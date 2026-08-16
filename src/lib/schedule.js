function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getDateOptions(daysAhead = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: daysAhead }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      value: toDateKey(date),
      label: formatDateLabel(date),
    };
  });
}

export const DATE_OPTIONS = getDateOptions();
export const DEFAULT_DATE = DATE_OPTIONS[0]?.value || toDateKey(new Date());

// "HH:MM" -> minutes since midnight, for easy comparison.
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

export function addMinutesToTime(time, minutesToAdd) {
  return minutesToTime(toMinutes(time) + minutesToAdd);
}

export function snapToNearestQuarter(minutes) {
  return Math.round(minutes / 15) * 15;
}

export function getTimeSlots(start = '08:00', end = '20:00', stepMinutes = 30) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const slots = [];
  for (let m = startMinutes; m < endMinutes; m += stepMinutes) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

// "YYYY-MM-DD" -> a whole-day integer, so (day, time) pairs can be combined
// into one absolute, comparable number of minutes.
function dayToDayIndex(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Combine a "YYYY-MM-DD" day and "HH:MM" time into one absolute minute count,
// so a block spanning multiple days can be treated as a single continuous
// span (start date+time through end date+time) instead of a daily window.
export function toAbsoluteMinutes(dayStr, timeStr) {
  return dayToDayIndex(dayStr) * 1440 + toMinutes(timeStr);
}

// An unavailability block is a single continuous span from
// (startDay, startTime) through (endDay, endTime) — e.g. "Fri 5pm through
// Mon 9am" — not a recurring daily window. Single-day blocks (legacy `day`
// field, or startDay === endDay) naturally collapse to that one window.
export function blocksOverlap(aStart, aEnd, bStart, bEnd) {
  return (
    toAbsoluteMinutes(aStart.day, aStart.time) < toAbsoluteMinutes(bEnd.day, bEnd.time) &&
    toAbsoluteMinutes(bStart.day, bStart.time) < toAbsoluteMinutes(aEnd.day, aEnd.time)
  );
}

// Given an activity and a list of a user's unavailability blocks, return the
// blocks (if any) that overlap it as a continuous start->end span.
export function findConflicts(activity, unavailabilityBlocks) {
  return unavailabilityBlocks.filter((b) =>
    blocksOverlap(
      { day: activity.day, time: activity.startTime },
      { day: activity.day, time: activity.endTime },
      { day: b.startDay || b.day, time: b.startTime },
      { day: b.endDay || b.day, time: b.endTime }
    )
  );
}
