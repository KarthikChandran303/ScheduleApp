import { useEffect, useMemo, useState } from 'react'
import type { Shift, UserProfile } from '../types'

export interface ShiftFormValues {
  title: string
  userId: string
  date: string
  startTime: string
  endTime: string
  color: string
  notes: string
}

interface ShiftFormModalProps {
  isOpen: boolean
  initialShift?: Shift | null
  selectedDate: string
  users: UserProfile[]
  onClose: () => void
  onSubmit: (values: ShiftFormValues, shiftId?: string) => Promise<void>
}

const defaultColor = '#2563eb'

export default function ShiftFormModal({
  isOpen,
  initialShift,
  selectedDate,
  users,
  onClose,
  onSubmit
}: ShiftFormModalProps) {
  const initialValues = useMemo<ShiftFormValues>(
    () => ({
      title: initialShift?.title ?? '',
      userId: initialShift?.userId ?? users[0]?.uid ?? '',
      date: initialShift?.date ?? selectedDate,
      startTime: initialShift?.startTime ?? '09:00',
      endTime: initialShift?.endTime ?? '17:00',
      color: initialShift?.color ?? defaultColor,
      notes: initialShift?.notes ?? ''
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialShift, selectedDate]
  )

  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  if (!isOpen) {
    return null
  }

  const handleChange = (field: keyof ShiftFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit(values, initialShift?.id)
      onClose()
    } catch {
      // Keep the modal open so the caller's error state stays visible.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {initialShift ? 'Edit shift' : 'Create shift'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Assign time, owner, and notes for this schedule block.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            <span>Shift title</span>
            <input
              required
              value={values.title}
              onChange={(event) => handleChange('title', event.target.value)}
              placeholder="Morning coverage"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span>Assigned user</span>
            <select
              required
              value={values.userId}
              onChange={(event) => handleChange('userId', event.target.value)}
            >
              {users.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span>Date</span>
            <input
              required
              type="date"
              value={values.date}
              onChange={(event) => handleChange('date', event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span>Start time</span>
            <input
              required
              type="time"
              value={values.startTime}
              onChange={(event) => handleChange('startTime', event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span>End time</span>
            <input
              required
              type="time"
              value={values.endTime}
              onChange={(event) => handleChange('endTime', event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            <span>Card color</span>
            <input
              required
              type="color"
              value={values.color}
              onChange={(event) => handleChange('color', event.target.value)}
              className="h-12"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            <span>Notes</span>
            <textarea
              rows={4}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              placeholder="Bring handheld devices for stockroom count."
            />
          </label>

          <div className="flex justify-end gap-3 md:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving...' : initialShift ? 'Save changes' : 'Create shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
