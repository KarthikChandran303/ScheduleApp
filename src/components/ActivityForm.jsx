import { useState } from 'react';
import { DATE_OPTIONS, blocksOverlap } from '../lib/schedule';

const ACTIVITY_COLORS = [
  { value: '#cfe4ff', label: 'Blue' },
  { value: '#bfe8df', label: 'Teal' },
  { value: '#ffe0a3', label: 'Amber' },
  { value: '#ffd0c7', label: 'Coral' },
  { value: '#d9ccf4', label: 'Plum' },
];

export default function ActivityForm({ initial, day, users, unavailability, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [activityDay, setActivityDay] = useState(initial?.day || day);
  const [startTime, setStartTime] = useState(initial?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '10:00');
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo || []);
  const [description, setDescription] = useState(initial?.description || '');
  const [venue, setVenue] = useState(initial?.venue || '');
  const [personNotes, setPersonNotes] = useState(initial?.personNotes || {});
  const [color, setColor] = useState(initial?.color || '#cfe4ff');
  const [isPublic, setIsPublic] = useState(initial?.isPublic !== false);

  function toggleUser(userId) {
    setAssignedTo((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  }

  function updatePersonNote(userId, note) {
    setPersonNotes((prev) => ({ ...prev, [userId]: note }));
  }

  function conflictFor(userId) {
    return unavailability.some(
      (b) =>
        b.userId === userId &&
        blocksOverlap(
          { day: activityDay, time: startTime },
          { day: activityDay, time: endTime },
          { day: b.startDay || b.day, time: b.startTime },
          { day: b.endDay || b.day, time: b.endTime }
        )
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      title,
      day: activityDay,
      startTime,
      endTime,
      assignedTo,
      description,
      venue,
      personNotes,
      color,
      isPublic,
    });
  }

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
      <label>
        <span className="form-field-label">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="form-row">
        <label>
          <span className="form-field-label">Day</span>
          <select value={activityDay} onChange={(e) => setActivityDay(e.target.value)}>
            {DATE_OPTIONS.map((dateOption) => (
              <option key={dateOption.value} value={dateOption.value}>
                {dateOption.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-field-label">Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          <span className="form-field-label">End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>
      <label>
        <span className="form-field-label">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="4"
          maxLength="1000"
          placeholder="Add a paragraph of context for this activity"
        />
      </label>
      <label>
        <span className="form-field-label">Venue</span>
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Room, building, or meeting link"
        />
      </label>
      <fieldset className="assign-list">
        <legend>Assign people</legend>
        {users.map((u) => (
          <label key={u.id} className={`assign-row ${assignedTo.includes(u.id) ? 'is-assigned' : ''}`}>
            <input
              type="checkbox"
              checked={assignedTo.includes(u.id)}
              onChange={() => toggleUser(u.id)}
            />
            {u.name}
            {conflictFor(u.id) && <span className="inline-warning">⚠ unavailable then</span>}
            {assignedTo.includes(u.id) && (
              <textarea
                className="person-note-input"
                value={personNotes[u.id] || ''}
                onChange={(e) => updatePersonNote(u.id, e.target.value)}
                rows="2"
                maxLength="500"
                placeholder={`Notes for ${u.name}`}
              />
            )}
          </label>
        ))}
      </fieldset>
      <label className="color-field">
        <span className="form-field-label">Color</span>
        <span
          className="color-presets"
          role="radiogroup"
          aria-label="Activity color"
          style={{ '--activity-accent-color': color }}
        >
          {ACTIVITY_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`color-swatch ${color === preset.value ? 'is-selected' : ''}`}
              style={{ backgroundColor: preset.value }}
              aria-label={preset.label}
              aria-pressed={color === preset.value}
              onClick={() => setColor(preset.value)}
            />
          ))}
        </span>
      </label>
      <label className="public-toggle">
        <span className="form-field-label">Visibility</span>
        <span className="visibility-control">
          <input type="checkbox" checked={!isPublic} onChange={(e) => setIsPublic(!e.target.checked)} />
          <span className="visibility-switch" aria-hidden="true"><span /></span>
          <span className="visibility-copy">
            <strong>{isPublic ? 'Public activity' : 'Private activity'}</strong>
            <small>{isPublic ? 'Visible to everyone in the schedule.' : 'Only assigned people and schedulers can see this.'}</small>
          </span>
        </span>
      </label>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
