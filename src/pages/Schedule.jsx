import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import DayTabs from '../components/DayTabs';
import ActivityForm from '../components/ActivityForm';
import { DATE_OPTIONS, DEFAULT_DATE, addMinutesToTime, findConflicts, getTimeSlots, toMinutes, minutesToTime, snapToNearestQuarter } from '../lib/schedule';

const CALENDAR_START_MINUTES = toMinutes('04:30');
const CALENDAR_END_MINUTES = toMinutes('20:00');
const ZOOM_PRESETS = { compact: 48, comfortable: 72, detailed: 96 };
const GRID_INTERVALS = [15, 30, 60];

export default function Schedule({ view = 'weekly' }) {
  const { firebaseUser, isScheduler, isGuest } = useAuth();
  const isDailyView = view === 'daily';
  const [zoom, setZoom] = useState(() => localStorage.getItem('schedule-zoom') || 'comfortable');
  const [gridInterval, setGridInterval] = useState(() => Number(localStorage.getItem('schedule-grid-interval') || 30));
  const slotHeight = ZOOM_PRESETS[zoom] || ZOOM_PRESETS.comfortable;
  const timeSlots = getTimeSlots('04:30', '20:00', gridInterval);
  const [activeDay, setActiveDay] = useState(DEFAULT_DATE);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [unavailability, setUnavailability] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [actionActivityId, setActionActivityId] = useState(null);
  const [showPublicSchedule, setShowPublicSchedule] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [scheduleLayout, setScheduleLayout] = useState(() => localStorage.getItem('schedule-layout') || 'calendar');
  const calendarSettingsRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragHighlightCell, setDragHighlightCell] = useState(null);
  const dragHighlightCellRef = useRef(null);
  const dragOffsetMinutes = useRef(0);
  const [resizingId, setResizingId] = useState(null);
  const [resizingState, setResizingState] = useState(null); // { id, startTime, endTime }
  const resizingStateRef = useRef(null);
  const resizeSessionRef = useRef(null);
  const touchDragCandidateRef = useRef(null);
  const suppressActivityClick = useRef(false);
  const gridBodyRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const viewingRef = useRef(null);
  const actionActivityIdRef = useRef(null);
  const activitiesRef = useRef([]);
  const isSchedulerRef = useRef(false);

  useEffect(() => localStorage.setItem('schedule-zoom', zoom), [zoom]);
  useEffect(() => localStorage.setItem('schedule-grid-interval', String(gridInterval)), [gridInterval]);
  useEffect(() => localStorage.setItem('schedule-layout', scheduleLayout), [scheduleLayout]);

  useEffect(() => {
    if (!showCalendarSettings) return undefined;
    const handleOutsideClick = (event) => {
      if (!calendarSettingsRef.current?.contains(event.target)) {
        setShowCalendarSettings(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showCalendarSettings]);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    const activityQueries = isScheduler
      ? [query(collection(db, 'activities'))]
      : isGuest
      ? [query(collection(db, 'activities'), where('isPublic', '==', true))]
      : [
          query(collection(db, 'activities'), where('assignedTo', 'array-contains', firebaseUser.uid)),
          query(collection(db, 'activities'), where('isPublic', '==', true)),
        ];
    const activitySnapshots = new Map();
    const updateActivityState = () => {
      const merged = new Map();
      activitySnapshots.forEach((snap) => {
        snap.docs.forEach((activityDoc) => merged.set(activityDoc.id, { id: activityDoc.id, ...activityDoc.data() }));
      });
      setActivities([...merged.values()]);
    };
    const unsubs = [
      ...activityQueries.map((activityQuery, index) =>
        onSnapshot(activityQuery, (snap) => {
          activitySnapshots.set(index, snap);
          updateActivityState();
        })
      ),
      // Guests have no Firestore access to the roster or unavailability data.
      ...(isGuest
        ? []
        : [
            onSnapshot(query(collection(db, 'users')), (snap) =>
              setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            ),
            onSnapshot(
              isScheduler
                ? query(collection(db, 'unavailability'))
                : query(collection(db, 'unavailability'), where('userId', '==', firebaseUser.uid)),
              (snap) =>
              setUnavailability(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            ),
          ]),
    ];
    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, isScheduler, isGuest, showPublicSchedule]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const visibleActivities = isScheduler
    ? activities
    : isGuest
    ? activities.filter((activity) => activity.isPublic !== false)
    : activities.filter((activity) =>
        activity.assignedTo.includes(firebaseUser.uid) || (showPublicSchedule && activity.isPublic !== false)
      );

  const hasAnyAssignedActivity =
    isScheduler || isGuest ? true : activities.some((activity) => activity.assignedTo.includes(firebaseUser.uid));

  const dayActivities = visibleActivities
    .filter((a) => a.day === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const visibleDateOptions = isDailyView ? DATE_OPTIONS.filter((date) => date.value === activeDay) : DATE_OPTIONS;

  const calendarActivities = useMemo(
    () =>
      Object.fromEntries(
        visibleActivities.map((a) => [a.id, { ...a, assignedNames: a.assignedTo.map((id) => usersById[id]?.name || 'Unknown') }])
      ),
    [visibleActivities, usersById]
  );

  async function handleSave(activity) {
    if (activity.id) {
      const { id, ...data } = activity;
      const previousActivity = activities.find((item) => item.id === id);
      setActivities((currentActivities) =>
        currentActivities.map((item) => item.id === id ? { ...item, ...data } : item)
      );
      setEditing(null);
      try {
        await updateDoc(doc(db, 'activities', id), data);
      } catch (error) {
        if (previousActivity) {
          setActivities((currentActivities) =>
            currentActivities.map((item) => item.id === id ? previousActivity : item)
          );
        }
        throw error;
      }
      return;
    } else {
      const activityRef = doc(collection(db, 'activities'));
      const optimisticActivity = { id: activityRef.id, ...activity };
      setActivities((currentActivities) => [...currentActivities, optimisticActivity]);
      setEditing(null);

      try {
        await setDoc(activityRef, activity);
      } catch (error) {
        setActivities((currentActivities) =>
          currentActivities.filter((item) => item.id !== activityRef.id)
        );
        throw error;
      }
      return;
    }
    setEditing(null);
  }

  async function handleDelete(activity) {
    await deleteDoc(doc(db, 'activities', activity.id));
  }

  // Update refs with current state for use in event listeners
  useEffect(() => {
    viewingRef.current = viewing;
    actionActivityIdRef.current = actionActivityId;
    activitiesRef.current = activities;
    isSchedulerRef.current = isScheduler;
  }, [viewing, actionActivityId, activities, isScheduler]);

  // Handle Delete key press to instantly delete viewed/selected activity (set up once)
  useEffect(() => {
    const handleKeyPress = async (event) => {
      // macOS keyboards send "Backspace" for the key labeled "delete"
      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
      if (isDeleteKey && isSchedulerRef.current) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
        let activityToDelete = null;
        if (viewingRef.current) {
          activityToDelete = viewingRef.current;
          setViewing(null);
        } else if (actionActivityIdRef.current) {
          activityToDelete = activitiesRef.current.find((a) => a.id === actionActivityIdRef.current);
          setActionActivityId(null);
        }
        if (activityToDelete) {
          try {
            await deleteDoc(doc(db, 'activities', activityToDelete.id));
          } catch (error) {
            console.error('Failed to delete activity:', error);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []); // Empty dependency array - listener is stable

  async function handleDrop(dateValue, slotStart) {
    if (!draggedId) return;
    const activity = activities.find((item) => item.id === draggedId);
    if (!activity) return;

    const durationMinutes = toMinutes(activity.endTime) - toMinutes(activity.startTime);
    const maxStartMinutes = Math.max(CALENDAR_START_MINUTES, CALENDAR_END_MINUTES - durationMinutes);
    const boundedStartMinutes = Math.min(
      maxStartMinutes,
      Math.max(CALENDAR_START_MINUTES, toMinutes(slotStart))
    );
    const boundedStart = getAvailableDropStart(
      dateValue,
      minutesToTime(boundedStartMinutes),
      durationMinutes,
      activity.id
    );
    const newEnd = addMinutesToTime(boundedStart, durationMinutes);

    await updateDoc(doc(db, 'activities', activity.id), {
      day: dateValue,
      startTime: boundedStart,
      endTime: newEnd,
    });

    setDraggedId(null);
    setDragHighlightCell(null);
    dragHighlightCellRef.current = null;
    dragOffsetMinutes.current = 0;
  }

  function getAvailableDropStart(day, proposedStart, durationMinutes, draggedActivityId) {
    const maxStartMinutes = Math.max(CALENDAR_START_MINUTES, CALENDAR_END_MINUTES - durationMinutes);
    let startMinutes = Math.min(maxStartMinutes, Math.max(CALENDAR_START_MINUTES, toMinutes(proposedStart)));

    const endMinutes = startMinutes + durationMinutes;
    const firstConflict = activities
      .filter((activity) => {
        if (activity.id === draggedActivityId || activity.day !== day) return false;
        const activityStart = toMinutes(activity.startTime);
        const activityEnd = toMinutes(activity.endTime);
        return startMinutes < activityEnd && activityStart < endMinutes;
      })
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];

    if (!firstConflict) return minutesToTime(startMinutes);

    return minutesToTime(
      Math.min(maxStartMinutes, Math.max(CALENDAR_START_MINUTES, toMinutes(firstConflict.endTime)))
    );
  }

  // Given cursor/touch coordinates, resolve which day column and time-of-day
  // they're over, purely from the grid body's bounding box (no need to hit
  // -test individual slot elements). Shared by mouse drag-over and touch drag.
  function computeDragTarget(clientX, clientY) {
    if (!gridBodyRef.current) return null;
    const gridBounds = gridBodyRef.current.getBoundingClientRect();
    const timeColumnWidth = 70;
    const cursorX = clientX - gridBounds.left - timeColumnWidth;
    const columnCount = visibleDateOptions.length;
    const availableWidth = gridBounds.width - timeColumnWidth;
    const columnWidth = availableWidth / columnCount;
    const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(cursorX / columnWidth)));
    const targetDate = visibleDateOptions[columnIndex]?.value;
    if (!targetDate) return null;

    const relativeY = clientY - gridBounds.top;
    const rawMinutesFromStart = (relativeY / slotHeight) * gridInterval;
    return { targetDate, rawMinutesFromStart };
  }

  function updateDragHighlightFromPoint(clientX, clientY, draggedActivity) {
    const target = computeDragTarget(clientX, clientY);
    if (!target) return;
    const draggedDuration = draggedActivity
      ? toMinutes(draggedActivity.endTime) - toMinutes(draggedActivity.startTime)
      : gridInterval;
    const proposedStart = CALENDAR_START_MINUTES + target.rawMinutesFromStart - dragOffsetMinutes.current;
    const snappedStart = snapToNearestQuarter(proposedStart);
    const maxStartMinutes = Math.max(CALENDAR_START_MINUTES, CALENDAR_END_MINUTES - draggedDuration);
    const dropStart = Math.max(CALENDAR_START_MINUTES, Math.min(maxStartMinutes, snappedStart));
    const availableStart = getAvailableDropStart(
      target.targetDate,
      minutesToTime(dropStart),
      draggedDuration,
      draggedActivity?.id
    );
    const nextHighlight = `${target.targetDate}-${availableStart}`;
    dragHighlightCellRef.current = nextHighlight;
    setDragHighlightCell(nextHighlight);
  }

  // Touch/pen dragging: HTML5 drag-and-drop isn't reliable on touch devices,
  // so activities use a long-press (to distinguish from scrolling) followed
  // by pointer-move tracking, mirroring the mouse drag-and-drop behavior.
  const TOUCH_DRAG_HOLD_MS = 250;
  const TOUCH_DRAG_MOVE_TOLERANCE = 10;

  function handleTouchDragStart(event, activity) {
    if (event.pointerType === 'mouse') return;
    if (!isScheduler || resizingStateRef.current) return;
    const element = event.currentTarget;
    const activityBounds = element.getBoundingClientRect();
    const candidate = {
      pointerId: event.pointerId,
      activity,
      element,
      startX: event.clientX,
      startY: event.clientY,
      offsetY: event.clientY - activityBounds.top,
      armed: false,
      timer: null,
    };
    touchDragCandidateRef.current = candidate;
    candidate.timer = window.setTimeout(() => {
      if (touchDragCandidateRef.current !== candidate) return;
      candidate.armed = true;
      try {
        element.setPointerCapture?.(event.pointerId);
      } catch {
        // Ignore — some browsers reject capture for edge cases; dragging
        // still works via the window-level pointermove/up fallback below.
      }
      const durationMinutes = toMinutes(activity.endTime) - toMinutes(activity.startTime);
      dragOffsetMinutes.current = Math.min(
        durationMinutes,
        Math.max(0, (candidate.offsetY / slotHeight) * gridInterval)
      );
      setActionActivityId(null);
      setViewing(null);
      suppressActivityClick.current = true;
      setDraggedId(activity.id);
    }, TOUCH_DRAG_HOLD_MS);
  }

  function handleTouchDragMove(event) {
    const candidate = touchDragCandidateRef.current;
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    if (!candidate.armed) {
      const dx = event.clientX - candidate.startX;
      const dy = event.clientY - candidate.startY;
      if (Math.abs(dx) > TOUCH_DRAG_MOVE_TOLERANCE || Math.abs(dy) > TOUCH_DRAG_MOVE_TOLERANCE) {
        clearTimeout(candidate.timer);
        touchDragCandidateRef.current = null;
      }
      return;
    }
    event.preventDefault();
    updateDragHighlightFromPoint(event.clientX, event.clientY, candidate.activity);
  }

  function handleTouchDragEnd(event) {
    const candidate = touchDragCandidateRef.current;
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    touchDragCandidateRef.current = null;
    clearTimeout(candidate.timer);
    if (!candidate.armed) return;
    try {
      candidate.element.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore — the pointer may already be inactive by the time we release it.
    }
    window.setTimeout(() => {
      suppressActivityClick.current = false;
    }, 100);
    const highlightStr = dragHighlightCellRef.current;
    if (highlightStr) {
      const dashIndex = highlightStr.lastIndexOf('-');
      handleDrop(highlightStr.substring(0, dashIndex), highlightStr.substring(dashIndex + 1));
    } else {
      setDraggedId(null);
      setDragHighlightCell(null);
      dragHighlightCellRef.current = null;
      dragOffsetMinutes.current = 0;
    }
  }

  function handleTouchDragCancel(event) {
    const candidate = touchDragCandidateRef.current;
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    touchDragCandidateRef.current = null;
    clearTimeout(candidate.timer);
    if (!candidate.armed) return;
    setDraggedId(null);
    setDragHighlightCell(null);
    dragHighlightCellRef.current = null;
    dragOffsetMinutes.current = 0;
    window.setTimeout(() => {
      suppressActivityClick.current = false;
    }, 100);
  }

  async function handleResizeActivity(activityId, edge, newTime) {
    const activity = resizingStateRef.current || activities.find((item) => item.id === activityId);
    if (!activity) return;

    if (edge === 'start') {
      const endMinutes = toMinutes(activity.endTime);
      const newMinutes = Math.max(CALENDAR_START_MINUTES, Math.min(toMinutes(newTime), endMinutes - 15));
      if (newMinutes < endMinutes) {
        const nextState = { ...activity, startTime: minutesToTime(newMinutes) };
        resizingStateRef.current = nextState;
        setResizingState(nextState);
      }
    } else if (edge === 'end') {
      const startMinutes = toMinutes(activity.startTime);
      const newMinutes = Math.min(CALENDAR_END_MINUTES, Math.max(toMinutes(newTime), startMinutes + 15));
      if (newMinutes > startMinutes) {
        const nextState = { ...activity, endTime: minutesToTime(newMinutes) };
        resizingStateRef.current = nextState;
        setResizingState(nextState);
      }
    }
  }

  async function commitResize(activityId) {
    const finalState = resizingStateRef.current;
    if (!finalState) return;
    const startMinutes = Math.max(CALENDAR_START_MINUTES, toMinutes(finalState.startTime));
    const endMinutes = Math.min(CALENDAR_END_MINUTES, toMinutes(finalState.endTime));
    if (endMinutes - startMinutes < 15) {
      resizingStateRef.current = null;
      setResizingState(null);
      setResizingId(null);
      return;
    }
    const nextTimes = {
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
    };

    resizingStateRef.current = null;
    setResizingState(null);
    setResizingId(null);

    await updateDoc(doc(db, 'activities', activityId), nextTimes);
  }

  function startResize(event, activity, edge) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActionActivityId(null);
    suppressActivityClick.current = true;
    setResizingId(activity.id);
    resizingStateRef.current = activity;
    setResizingState(activity);
    resizeSessionRef.current = {
      activityId: activity.id,
      edge,
      startY: event.clientY,
      originalTime: edge === 'start' ? activity.startTime : activity.endTime,
    };
  }

  function handleResizePointerMove(event) {
    const session = resizeSessionRef.current;
    if (!session) return;
    event.preventDefault();
    const deltaY = event.clientY - session.startY;
    const deltaMinutes = snapToNearestQuarter(Math.round((deltaY / slotHeight) * gridInterval));
    const newMinutes = toMinutes(session.originalTime) + deltaMinutes;
    handleResizeActivity(session.activityId, session.edge, minutesToTime(snapToNearestQuarter(newMinutes)));
  }

  async function finishResize(event) {
    const session = resizeSessionRef.current;
    if (!session) return;
    event.preventDefault();
    resizeSessionRef.current = null;
    await commitResize(session.activityId);
    window.setTimeout(() => {
      suppressActivityClick.current = false;
    }, 100);
  }

  function getCurrentTimePosition() {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const slotMinutes = gridInterval;
    const minutesFromCalendarStart = totalMinutes - CALENDAR_START_MINUTES;
    const visibleMinutes = Math.max(
      0,
      Math.min(CALENDAR_END_MINUTES - CALENDAR_START_MINUTES, minutesFromCalendarStart)
    );
    return (visibleMinutes / slotMinutes) * slotHeight;
  }

  function isToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  }

  function isPastActivity(activity, day) {
    const localToday = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
    if (day < localToday) return true;
    if (day > localToday) return false;
    return toMinutes(activity.endTime) <= currentTime.getHours() * 60 + currentTime.getMinutes();
  }

  return (
    <div className="page schedule-page">
      <div className="schedule-header">
        <h2>{isDailyView ? 'Daily schedule' : 'Weekly schedule'}</h2>
        <div className="schedule-tools">
        <div className="calendar-settings-wrap" ref={calendarSettingsRef}>
          <button
            type="button"
            className={`calendar-settings-button ${showCalendarSettings ? 'is-open' : ''}`}
            aria-expanded={showCalendarSettings}
            onClick={() => setShowCalendarSettings((visible) => !visible)}
          >
            <span aria-hidden="true">☷</span> View settings
          </button>
          <div className="layout-switcher" aria-label="Schedule layout">
            <button type="button" className={scheduleLayout === 'calendar' ? 'is-active' : ''} onClick={() => setScheduleLayout('calendar')}>Calendar</button>
            <button type="button" className={scheduleLayout === 'agenda' ? 'is-active' : ''} onClick={() => setScheduleLayout('agenda')}>Agenda</button>
          </div>
          {showCalendarSettings && (
            <div className="calendar-settings-popover" aria-label="Calendar display settings">
              <div className="settings-group">
                <span className="settings-label">Zoom</span>
                <div className="settings-segmented">
                  {['compact', 'comfortable', 'detailed'].map((preset) => (
                    <button key={preset} type="button" className={zoom === preset ? 'is-active' : ''} onClick={() => setZoom(preset)}>
                      {preset[0].toUpperCase() + preset.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-group">
                <span className="settings-label">Grid interval</span>
                <div className="settings-segmented">
                  {GRID_INTERVALS.map((interval) => (
                    <button key={interval} type="button" className={gridInterval === interval ? 'is-active' : ''} onClick={() => setGridInterval(interval)}>
                      {interval} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {!isScheduler && !isGuest && (
          <label className="schedule-visibility-toggle">
            <input
              type="checkbox"
              checked={showPublicSchedule}
              onChange={(event) => setShowPublicSchedule(event.target.checked)}
            />
            <span className="schedule-toggle-track" aria-hidden="true"><span /></span>
            <span className="schedule-toggle-copy">
              <strong>{showPublicSchedule ? 'Public schedule' : 'My schedule'}</strong>
              <small>{showPublicSchedule ? 'Assigned + public activities' : 'Assigned activities only'}</small>
            </span>
          </label>
        )}
        {isScheduler && (
          <button
            className="primary-button"
            onClick={() => {
              setActionActivityId(null);
              setViewing(null);
              setEditing({ day: activeDay, startTime: '09:00', endTime: '10:00', assignedTo: [] });
            }}
          >
            + New activity
          </button>
        )}
        </div>
      </div>

      <DayTabs activeDay={activeDay} onSelect={setActiveDay} />

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing.id ? 'Edit activity' : 'New activity'}</h2>
              <button type="button" className="modal-close" aria-label="Close dialog" onClick={() => setEditing(null)}>×</button>
            </div>
            <ActivityForm
              initial={editing}
              day={activeDay}
              users={users}
              unavailability={unavailability}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal activity-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header view-header">
              <div>
                <span className="view-eyebrow">Activity details</span>
                <h2>{viewing.title}</h2>
              </div>
              <button type="button" className="modal-close" aria-label="Close dialog" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="view-detail"><strong>When</strong><span>{viewing.day} · {viewing.startTime}–{viewing.endTime}</span></div>
            {!isGuest && (
              <div className="view-detail view-people-detail">
                <strong>People</strong>
                <div className="view-people-list">
                  {viewing.assignedTo.length === 0 && <span>Unassigned</span>}
                  {viewing.assignedTo.map((id) => (
                    <div key={id} className="view-person">
                      <strong>{usersById[id]?.name || 'Unknown'}</strong>
                      {viewing.personNotes?.[id] && <span>{viewing.personNotes[id]}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {viewing.venue && <div className="view-detail"><strong>Venue</strong><span>{viewing.venue}</span></div>}
            {viewing.description && <div className="view-detail view-description"><strong>Description</strong><span>{viewing.description}</span></div>}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setViewing(null)}>Close</button>
              {isScheduler && <button type="button" className="view-edit-action" onClick={() => { setViewing(null); setEditing(viewing); }}>Edit</button>}
            </div>
          </div>
        </div>
      )}

      <div className={`calendar-board ${isDailyView ? 'daily-view' : ''} ${scheduleLayout === 'agenda' ? 'is-hidden' : ''}`} style={{ '--slot-height': `${slotHeight}px` }} role="grid" aria-label={`${isDailyView ? 'Daily' : 'Weekly'} schedule calendar`}>
        {!showPublicSchedule && !hasAnyAssignedActivity && (
          <div className="no-assignments-overlay">
            <p>You haven't been assigned any activities yet.</p>
            <button type="button" onClick={() => setShowPublicSchedule(true)}>
              View public schedule
            </button>
          </div>
        )}
        <div className="calendar-grid-header">
          <div className="time-column-label">Time</div>
          {visibleDateOptions.map((dateOption) => (
            <div
              key={dateOption.value}
              className={`calendar-date-header ${activeDay === dateOption.value ? 'active' : ''}`}
              onClick={() => setActiveDay(dateOption.value)}
            >
              <span>{dateOption.label}</span>
            </div>
          ))}
        </div>

        <div
          className="calendar-grid-body"
          ref={gridBodyRef}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const highlightStr = dragHighlightCellRef.current;
            dragHighlightCellRef.current = null;
            setDragHighlightCell(null);
            dragOffsetMinutes.current = 0;
            if (!highlightStr) return;
            const dashIndex = highlightStr.lastIndexOf('-');
            const highlightDate = highlightStr.substring(0, dashIndex);
            const highlightTime = highlightStr.substring(dashIndex + 1);
            handleDrop(highlightDate, highlightTime);
          }}
        >
          <div className="calendar-time-column">
            {timeSlots.map((time) => (
              <div key={time} className="calendar-time-slot">
                {time}
              </div>
            ))}
          </div>

          {visibleDateOptions.map((dateOption) => (
            <div 
              key={dateOption.value} 
              className="calendar-day-column"
            >
              {(() => {
                const draggedActivity = draggedId ? visibleActivities.find((item) => item.id === draggedId) : null;
                const highlightDay = dragHighlightCell?.slice(0, 10);
                const highlightStart = dragHighlightCell ? toMinutes(dragHighlightCell.slice(11)) : null;
                const draggedDuration = draggedActivity
                  ? toMinutes(draggedActivity.endTime) - toMinutes(draggedActivity.startTime)
                  : 0;
                const highlightEnd = highlightStart === null ? null : highlightStart + draggedDuration;

                return (
                  <>
              <div
                className={`current-time-indicator ${isToday(dateOption.value) ? 'is-today' : 'is-other-day'}`}
                style={{ top: `${getCurrentTimePosition()}px` }}
              />
              {timeSlots.map((time) => {
                const slotActivities = visibleActivities.filter(
                  (activity) => {
                    if (activity.day !== dateOption.value) return false;
                    const activityStart = toMinutes(activity.startTime);
                    const slotStart = toMinutes(time);
                    return activityStart >= slotStart && activityStart < slotStart + gridInterval;
                  }
                );
                const cellKey = `${dateOption.value}-${time}`;
                const slotStart = toMinutes(time);
                const highlightMinutes =
                  draggedActivity &&
                  highlightDay === dateOption.value &&
                  highlightStart !== null &&
                  highlightEnd !== null
                    ? Math.max(0, Math.min(highlightEnd, slotStart + gridInterval) - Math.max(highlightStart, slotStart))
                    : 0;
                const highlightOffsetMinutes =
                  highlightStart === null
                    ? 0
                    : Math.max(0, Math.max(highlightStart, slotStart) - CALENDAR_START_MINUTES);

                return (
                  <div
                    key={cellKey}
                    className={`calendar-slot ${activeDay === dateOption.value ? 'is-active' : ''} ${highlightMinutes > 0 ? 'drag-highlight' : ''} ${isScheduler && slotActivities.length === 0 ? 'is-clickable' : ''}`}
                    onClick={() => {
                      if (isScheduler && slotActivities.length === 0 && !draggedId && !resizingId) {
                        setActionActivityId(null);
                        setViewing(null);
                        setActiveDay(dateOption.value);
                        setEditing({
                          day: dateOption.value,
                          startTime: time,
                          endTime: addMinutesToTime(time, gridInterval),
                          assignedTo: [],
                        });
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedId && gridBodyRef.current) {
                        const gridBounds = gridBodyRef.current.getBoundingClientRect();
                        const slotBounds = event.currentTarget.getBoundingClientRect();
                        const cursorOffsetMinutes = ((event.clientY - slotBounds.top) / slotHeight) * gridInterval;
                        // Determine actual date column based on cursor X position
                        const timeColumnWidth = 70;
                        const cursorX = event.clientX - gridBounds.left - timeColumnWidth;
                        const columnCount = visibleDateOptions.length;
                        const availableWidth = gridBounds.width - timeColumnWidth;
                        const columnWidth = availableWidth / columnCount;
                        const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(cursorX / columnWidth)));
                        const targetDate = visibleDateOptions[columnIndex].value;
                        
                        const draggedDuration =
                          draggedActivity ?
                            toMinutes(draggedActivity.endTime) - toMinutes(draggedActivity.startTime) :
                            gridInterval;
                        
                        const proposedStart =
                          toMinutes(time) + cursorOffsetMinutes - dragOffsetMinutes.current;
                        const snappedStart = snapToNearestQuarter(proposedStart);
                        const dropStart = Math.max(
                          CALENDAR_START_MINUTES,
                          Math.min(CALENDAR_END_MINUTES - draggedDuration, snappedStart)
                        );
                        const maxStartMinutes = Math.max(
                          CALENDAR_START_MINUTES,
                          CALENDAR_END_MINUTES - draggedDuration
                        );
                        const availableStart = getAvailableDropStart(
                          targetDate,
                          minutesToTime(Math.min(maxStartMinutes, dropStart)),
                          draggedDuration,
                          draggedId
                        );
                        const nextHighlight = `${targetDate}-${availableStart}`;
                        dragHighlightCellRef.current = nextHighlight;
                        setDragHighlightCell(nextHighlight);
                      }
                    }}
                    onDragLeave={() => {
                      dragHighlightCellRef.current = null;
                      setDragHighlightCell(null);
                    }}
                  >
                    {highlightMinutes > 0 && (
                      <div
                        className="drag-highlight-overlay"
                        style={{
                          top: `${(highlightOffsetMinutes / gridInterval) * slotHeight}px`,
                          height: `${(highlightMinutes / gridInterval) * slotHeight}px`,
                        }}
                      />
                    )}
                    {slotActivities.map((activity) => {
                      const record = calendarActivities[activity.id];
                      const conflicts = activity.assignedTo
                        .flatMap((id) =>
                          findConflicts(activity, unavailability.filter((b) => b.userId === id)).map((c) => ({
                            ...c,
                            name: usersById[id]?.name || 'Unknown',
                          }))
                        )
                        .filter((conflict, index, allConflicts) =>
                          allConflicts.findIndex((candidate) => candidate.name === conflict.name) === index
                        );

                      // Use resizing state if currently resizing this activity
                      const displayActivity = resizingState?.id === activity.id ? resizingState : activity;
                      const startMinutes = toMinutes(displayActivity.startTime);
                      const endMinutes = toMinutes(displayActivity.endTime);
                      const durationMinutes = endMinutes - startMinutes;
                      const heightPx = (durationMinutes / gridInterval) * slotHeight;
                      const activityTopPx = ((startMinutes - CALENDAR_START_MINUTES) / gridInterval) * slotHeight;
                      const showAssignees = durationMinutes >= 45 && !isGuest;

                      return (
                        <div
                          key={activity.id}
                          className={`calendar-activity ${isScheduler ? 'is-touch-draggable' : ''} ${actionActivityId === activity.id ? 'is-selected' : ''} ${draggedId === activity.id ? 'is-dragging' : ''} ${isPastActivity(displayActivity, dateOption.value) ? 'is-past' : ''} ${resizingId === activity.id ? 'is-resizing' : ''}`}
                          style={{
                            height: `${heightPx}px`,
                            top: `${activityTopPx}px`,
                            '--activity-custom-color': displayActivity.color || '#cfe4ff',
                            '--activity-accent-color': displayActivity.color || '#2b8ab8',
                          }}
                          draggable={isScheduler && resizingId !== activity.id}
                          onDragStart={(event) => {
                            if (resizingStateRef.current) {
                              event.preventDefault();
                              return;
                            }
                            const activityBounds = event.currentTarget.getBoundingClientRect();
                            const durationMinutes = toMinutes(activity.endTime) - toMinutes(activity.startTime);
                            dragOffsetMinutes.current = Math.min(
                              durationMinutes,
                              Math.max(0, ((event.clientY - activityBounds.top) / slotHeight) * gridInterval)
                            );
                            setDraggedId(activity.id);
                            setActionActivityId(null);
                            setViewing(null);
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragHighlightCell(null);
                            dragHighlightCellRef.current = null;
                            dragOffsetMinutes.current = 0;
                          }}
                          onPointerDown={(event) => handleTouchDragStart(event, activity)}
                          onPointerMove={(event) => {
                            handleResizePointerMove(event);
                            handleTouchDragMove(event);
                          }}
                          onPointerUp={(event) => {
                            finishResize(event);
                            handleTouchDragEnd(event);
                          }}
                          onPointerCancel={handleTouchDragCancel}
                          onClick={() => {
                            if (resizingId || suppressActivityClick.current) return;
                            if (!isScheduler) {
                              // General users and guests can only ever "View" anyway,
                              // so skip straight to the details dialog.
                              setViewing(activity);
                              return;
                            }
                            setActionActivityId((currentId) => currentId === activity.id ? null : activity.id);
                          }}
                        >
                          {isScheduler && (
                            <>
                              <div
                                className="activity-resize-handle top"
                                onPointerDown={(event) => startResize(event, activity, 'start')}
                              />
                              <div
                                className="activity-resize-handle bottom"
                                onPointerDown={(event) => startResize(event, activity, 'end')}
                              />
                            </>
                          )}
                          <div className="calendar-activity-content">
                            <div className="calendar-activity-title">{displayActivity.title}</div>
                            <div className="calendar-activity-time activity-detail-row">
                              <span aria-hidden="true">◷</span>
                              {displayActivity.startTime}–{displayActivity.endTime}
                            </div>
                            {showAssignees && (
                              <div className="calendar-activity-users activity-detail-row">
                                <span aria-hidden="true">♙</span>
                                {record?.assignedNames?.join(', ') || 'Unassigned'}
                              </div>
                            )}
                            {conflicts.length > 0 && (
                              <div className="calendar-activity-conflict">
                                ⚠ {conflicts.map((c) => c.name).join(', ')} unavailable
                              </div>
                            )}
                          </div>
                          <div
                            className={`calendar-activity-tooltip ${actionActivityId === activity.id ? 'is-open' : ''}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button type="button" className="activity-action view" onClick={() => { setActionActivityId(null); setViewing(activity); }}>View</button>
                            {isScheduler && <button type="button" className="activity-action edit" onClick={() => { setActionActivityId(null); setEditing(activity); }}>Edit</button>}
                            {isScheduler && <button type="button" className="activity-action delete" onClick={() => { setActionActivityId(null); handleDelete(activity); }}>Delete</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {scheduleLayout === 'agenda' && (
        <div className="agenda-heading">
          <span>Agenda</span>
          <strong>{DATE_OPTIONS.find((date) => date.value === activeDay)?.label}</strong>
        </div>
      )}
      <div className={`activity-list agenda-list ${scheduleLayout === 'agenda' ? 'is-visible' : ''}`}>
        {dayActivities.length === 0 && <p className="empty-state">Nothing scheduled for this date.</p>}
        {dayActivities.map((activity) => {
          const assignedNames = activity.assignedTo.map((id) => usersById[id]?.name || 'Unknown');
          const conflicts = activity.assignedTo
            .flatMap((id) =>
              findConflicts(activity, unavailability.filter((b) => b.userId === id)).map((c) => ({
                ...c,
                name: usersById[id]?.name || 'Unknown',
              }))
            )
            .filter((conflict, index, allConflicts) =>
              allConflicts.findIndex((candidate) => candidate.name === conflict.name) === index
            );

          return (
            <div
              key={activity.id}
              className="activity-card compact-card"
              style={{ '--activity-custom-color': activity.color || '#cfe4ff' }}
            >
              <div className="activity-time"><span aria-hidden="true">◷</span>{activity.startTime}–{activity.endTime}</div>
              <div className="activity-body">
                <div className="activity-title">{activity.title}</div>
                {!isGuest && (
                  <div className="activity-people activity-meta-row"><span aria-hidden="true">♙</span>{assignedNames.join(', ') || 'Unassigned'}</div>
                )}
                {activity.venue && <div className="activity-venue activity-meta-row"><span aria-hidden="true">⌖</span>{activity.venue}</div>}
                {activity.description && <div className="activity-description activity-meta-row"><span aria-hidden="true">▤</span>{activity.description}</div>}
                {conflicts.length > 0 && (
                  <div className="activity-conflict">
                    ⚠ {conflicts.map((c) => c.name).join(', ')} unavailable at this time
                  </div>
                )}
              </div>
              {isScheduler && (
                <div className="activity-actions">
                  <button className="icon-button" onClick={() => { setActionActivityId(null); setViewing(null); setEditing(activity); }}>
                    Edit
                  </button>
                  <button className="icon-button danger" onClick={() => handleDelete(activity)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
