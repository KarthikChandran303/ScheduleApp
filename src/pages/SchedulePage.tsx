import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { addDays, endOfWeek, format, isWithinInterval, parseISO, startOfWeek, subDays } from 'date-fns'
import NavBar from '../components/NavBar'
import ScheduleBoard from '../components/ScheduleBoard'
import ShiftFormModal, { type ShiftFormValues } from '../components/ShiftFormModal'
import UserManagementPanel from '../components/UserManagementPanel'
import { useAuth } from '../hooks/useAuth'
import { db } from '../firebase'
import type { Role, Shift, UserProfile } from '../types'
import { canManageShifts, isAdmin } from '../utils/permissions'

export default function SchedulePage() {
  const { currentUser, refreshUserProfile, userProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftPendingDelete, setShiftPendingDelete] = useState<Shift | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((entry) => entry.data() as UserProfile))
    })

    const weekStartKey = format(weekStart, 'yyyy-MM-dd')
    const weekEndKey = format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('date', '>=', weekStartKey),
      where('date', '<=', weekEndKey),
      orderBy('date')
    )

    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      setShifts(snapshot.docs.map((entry) => entry.data() as Shift))
    })

    return () => {
      unsubscribeUsers()
      unsubscribeShifts()
    }
  }, [weekStart])

  const role = userProfile?.role ?? null
  const managerAccess = canManageShifts(role)
  const adminAccess = isAdmin(role)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  const visibleShifts = useMemo(
    () =>
      shifts.filter((shift) =>
        isWithinInterval(parseISO(shift.date), {
          start: weekStart,
          end: weekEnd
        })
      ),
    [shifts, weekEnd, weekStart]
  )

  const usersById = useMemo(
    () =>
      users.reduce<Record<string, string>>((lookup, user) => {
        lookup[user.uid] = user.displayName
        return lookup
      }, {}),
    [users]
  )

  const openCreateModal = (date: string) => {
    setEditingShift(null)
    setSelectedDate(date)
    setIsModalOpen(true)
  }

  const handleSaveShift = async (values: ShiftFormValues, shiftId?: string) => {
    setError(null)
    setFeedback(null)

    try {
      if (shiftId) {
        await updateDoc(doc(db, 'shifts', shiftId), {
          ...values,
          notes: values.notes.trim()
        })
        setFeedback('Shift updated successfully.')
        return
      }

      const shiftRef = doc(collection(db, 'shifts'))
      await setDoc(shiftRef, {
        id: shiftRef.id,
        ...values,
        notes: values.notes.trim()
      })
      setFeedback('Shift created successfully.')
    } catch {
      setError('Unable to save shift. Confirm Firebase configuration and permissions.')
      throw new Error('Shift save failed')
    }
  }

  const handleDeleteShift = async (shiftId: string) => {
    const shiftToDelete = shifts.find((shift) => shift.id === shiftId) ?? null
    setShiftPendingDelete(shiftToDelete)
  }

  const confirmDeleteShift = async () => {
    if (!shiftPendingDelete) {
      return
    }

    setError(null)
    setFeedback(null)

    try {
      await deleteDoc(doc(db, 'shifts', shiftPendingDelete.id))
      setShiftPendingDelete(null)
      setFeedback('Shift deleted.')
    } catch {
      setError('Unable to delete shift. Confirm Firebase permissions.')
    }
  }

  const handleMoveShift = async (shiftId: string, date: string) => {
    setError(null)
    setFeedback(null)

    try {
      await updateDoc(doc(db, 'shifts', shiftId), { date })
      setFeedback(`Shift moved to ${format(parseISO(date), 'EEEE, MMM d')}.`)
    } catch {
      setError('Unable to move shift. Confirm Firebase permissions.')
    }
  }

  const handleRoleChange = async (uid: string, roleToAssign: Role) => {
    setError(null)
    setFeedback(null)

    try {
      await updateDoc(doc(db, 'users', uid), { role: roleToAssign })
      if (currentUser?.uid === uid) {
        await refreshUserProfile(uid)
      }
      setFeedback('User role updated.')
    } catch {
      setError('Unable to update user role. Confirm Firebase permissions.')
    }
  }

  return (
    <div className="min-h-screen text-slate-100">
      <NavBar />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Weekly schedule</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Drag shifts across weekdays to rebalance staffing in real time.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setWeekStart((current) => subDays(current, 7))}
                  className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Previous week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                  className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Current week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekStart((current) => addDays(current, 7))}
                  className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Next week
                </button>
                {managerAccess ? (
                  <button
                    type="button"
                    onClick={() => openCreateModal(format(weekStart, 'yyyy-MM-dd'))}
                    className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                  >
                    Create shift
                  </button>
                ) : null}
              </div>
            </div>

            {(feedback || error) && (
              <div
                className={`mt-5 rounded-2xl px-4 py-3 text-sm ${error ? 'border border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}
              >
                {error ?? feedback}
              </div>
            )}
          </div>

          <aside className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/20">
              <p className="text-sm text-slate-400">Active role</p>
              <p className="mt-2 text-3xl font-semibold capitalize text-white">{role ?? 'employee'}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/20">
              <p className="text-sm text-slate-400">Team members</p>
              <p className="mt-2 text-3xl font-semibold text-white">{users.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/20">
              <p className="text-sm text-slate-400">Shifts this week</p>
              <p className="mt-2 text-3xl font-semibold text-white">{visibleShifts.length}</p>
            </div>
          </aside>
        </section>

        <ScheduleBoard
          weekStart={weekStart}
          shifts={visibleShifts}
          usersById={usersById}
          canManage={managerAccess}
          onCreateShift={openCreateModal}
          onEditShift={(shift) => {
            setEditingShift(shift)
            setSelectedDate(shift.date)
            setIsModalOpen(true)
          }}
          onDeleteShift={handleDeleteShift}
          onMoveShift={handleMoveShift}
        />

        {adminAccess ? <UserManagementPanel users={users} onRoleChange={handleRoleChange} /> : null}
      </main>

      <ShiftFormModal
        isOpen={isModalOpen}
        initialShift={editingShift}
        selectedDate={selectedDate}
        users={users}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveShift}
      />

      {shiftPendingDelete ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40">
            <h2 className="text-xl font-semibold text-white">Delete shift?</h2>
            <p className="mt-3 text-sm text-slate-400">
              Remove <span className="font-semibold text-slate-200">{shiftPendingDelete.title}</span> on{' '}
              {format(parseISO(shiftPendingDelete.date), 'EEEE, MMM d')} for{' '}
              <span className="font-semibold text-slate-200">
                {usersById[shiftPendingDelete.userId] ?? 'this team member'}
              </span>
              .
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShiftPendingDelete(null)}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteShift}
                className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400"
              >
                Delete shift
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
