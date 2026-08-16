import type { Shift } from '../types'

interface ShiftCardProps {
  shift: Shift
  userName: string
  canManage: boolean
  onEdit: (shift: Shift) => void
  onDelete: (shiftId: string) => void
}

export default function ShiftCard({ shift, userName, canManage, onEdit, onDelete }: ShiftCardProps) {
  return (
    <article
      className="rounded-2xl border border-white/10 p-3 text-slate-100 shadow-lg shadow-slate-950/20"
      style={{ backgroundColor: shift.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{shift.title}</h3>
          <p className="mt-1 text-xs text-white/80">{userName}</p>
        </div>

        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(shift)}
              className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/25"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(shift.id)}
              className="rounded-full bg-slate-950/35 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-950/55"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1 text-xs text-white/90">
        <p>
          {shift.startTime} - {shift.endTime}
        </p>
        {shift.notes ? <p className="line-clamp-3 text-white/75">{shift.notes}</p> : null}
      </div>
    </article>
  )
}
