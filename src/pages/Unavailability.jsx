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
import { DATE_OPTIONS } from '../lib/schedule';

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
    const rangeStart = new Date(`${startDay}T00:00:00`);
    const rangeEnd = new Date(`${endDay}T00:00:00`);
    if (rangeEnd < rangeStart || endTime <= startTime) return;

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
        Mark times you're not available. Schedulers will see a warning if they try to assign you
        during a block.
      </p>

      <form className="unavailability-form" onSubmit={handleAdd}>
        <div className="form-row">
          <label>
            From date
            <input type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} required />
          </label>
          <label>
            To date
            <input type="date" value={endDay} onChange={(e) => setEndDay(e.target.value)} required />
          </label>
          <label>
            From
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            To
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. doctor's appointment" />
        </label>
        <button type="submit">Add block</button>
      </form>

      <ul className="block-list">
        {sorted.map((b) => (
          <li key={b.id} className="block-item">
            <span>
              <strong>{b.startDay || b.day}</strong>{b.endDay && b.endDay !== b.startDay ? `–${b.endDay}` : ''} {b.startTime}–{b.endTime}
              {b.note && <span className="block-note"> — {b.note}</span>}
            </span>
            <button className="link-button" onClick={() => handleRemove(b.id)}>
              Remove
            </button>
          </li>
        ))}
        {sorted.length === 0 && <p className="empty-state">No unavailability blocks yet.</p>}
      </ul>
    </div>
  );
}
