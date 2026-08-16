import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { DATE_OPTIONS, toAbsoluteMinutes } from '../lib/schedule';

export default function Unavailability() {
  const { firebaseUser } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [startDay, setStartDay] = useState(DATE_OPTIONS[0]?.value || '');
  const [endDay, setEndDay] = useState(DATE_OPTIONS[0]?.value || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'unavailability'), where('userId', '==', firebaseUser.uid));
    return onSnapshot(q, (snap) => setBlocks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [firebaseUser]);

  async function handleAdd(e) {
    e.preventDefault();
    if (toAbsoluteMinutes(endDay, endTime) <= toAbsoluteMinutes(startDay, startTime)) return;

    await addDoc(collection(db, 'unavailability'), {
      userId: firebaseUser.uid,
      startDay,
      endDay,
      startTime,
      endTime,
      note: note.trim(),
    });
    setNote('');
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db, 'unavailability', id));
  }

  const sorted = [...blocks].sort(
    (a, b) => (a.startDay || a.day || '').localeCompare(b.startDay || b.day || '') || a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="page">
      <h2>My unavailability</h2>
      <p className="page-subtitle">
        Mark when you're unavailable. Schedulers get a warning if they assign you then.
      </p>

      <form className="unavailability-form" onSubmit={handleAdd}>
        <div className="form-row unavailability-range">
          <fieldset className="field-group">
            <legend>From</legend>
            <div className="field-group-inputs">
              <input type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} required />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </fieldset>
          <span className="field-group-arrow" aria-hidden="true">→</span>
          <fieldset className="field-group">
            <legend>To</legend>
            <div className="field-group-inputs">
              <input type="date" value={endDay} onChange={(e) => setEndDay(e.target.value)} required />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </fieldset>
        </div>
        <label>
          <span className="form-field-label">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. doctor's appointment" />
        </label>
        <div className="form-actions">
          <button type="submit">Add block</button>
        </div>
      </form>

      <ul className="block-list">
        {sorted.map((b) => {
          const startDayValue = b.startDay || b.day;
          const endDayValue = b.endDay || b.day;
          const isMultiDay = endDayValue !== startDayValue;
          return (
            <li key={b.id} className="block-item">
              <div className="block-item-copy">
                {isMultiDay ? (
                  <span className="block-item-date">
                    {startDayValue} {b.startTime} <span aria-hidden="true">→</span> {endDayValue} {b.endTime}
                  </span>
                ) : (
                  <>
                    <span className="block-item-date">{startDayValue}</span>
                    <span className="block-item-time">{b.startTime}–{b.endTime}</span>
                  </>
                )}
                {b.note && <span className="block-note">{b.note}</span>}
              </div>
              <button className="icon-button danger" onClick={() => handleRemove(b.id)} aria-label="Remove">
                Remove
              </button>
            </li>
          );
        })}
        {sorted.length === 0 && <p className="empty-state">No unavailability blocks yet.</p>}
      </ul>
    </div>
  );
}
