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

// Given an activity and a list of a user's unavailability blocks, return the
// blocks (if any) that overlap it on the same day.
export function findConflicts(activity, unavailabilityBlocks) {
  return unavailabilityBlocks.filter(
    (b) =>
      activity.day >= (b.startDay || b.day) &&
      activity.day <= (b.endDay || b.day) &&
      rangesOverlap(activity.startTime, activity.endTime, b.startTime, b.endTime)
  );
}
