import { addDays, format, isSameDay, parseISO } from 'date-fns'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult
} from '@hello-pangea/dnd'
import type { Shift } from '../types'
import ShiftCard from './ShiftCard'

interface ScheduleBoardProps {
  weekStart: Date
  shifts: Shift[]
  usersById: Record<string, string>
  canManage: boolean
  onCreateShift: (date: string) => void
  onEditShift: (shift: Shift) => void
  onDeleteShift: (shiftId: string) => void
  onMoveShift: (shiftId: string, date: string) => Promise<void>
}

export default function ScheduleBoard({
  weekStart,
  shifts,
  usersById,
  canManage,
  onCreateShift,
  onEditShift,
  onDeleteShift,
  onMoveShift
}: ScheduleBoardProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) {
      return
    }

    if (result.source.droppableId === result.destination.droppableId) {
      return
    }

    await onMoveShift(result.draggableId, result.destination.droppableId)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid gap-4 xl:grid-cols-7">
        {days.map((day) => {
          const dayId = format(day, 'yyyy-MM-dd')
          const dayShifts = shifts
            .filter((shift) => isSameDay(parseISO(shift.date), day))
            .sort((first, second) => first.startTime.localeCompare(second.startTime))

          return (
            <section
              key={dayId}
              className="flex min-h-[19rem] flex-col rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-slate-950/20"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    {format(day, 'EEE')}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{format(day, 'MMM d')}</h3>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => onCreateShift(dayId)}
                    className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-400"
                  >
                    + Shift
                  </button>
                ) : null}
              </div>

              <Droppable droppableId={dayId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-1 flex-col gap-3 p-4 transition ${snapshot.isDraggingOver ? 'bg-sky-500/8' : ''}`}
                  >
                    {dayShifts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
                        No shifts scheduled.
                      </div>
                    ) : null}

                    {dayShifts.map((shift, index) => (
                      <Draggable key={shift.id} draggableId={shift.id} index={index} isDragDisabled={!canManage}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={dragSnapshot.isDragging ? 'rotate-[1deg] scale-[1.01]' : ''}
                          >
                            <ShiftCard
                              shift={shift}
                              userName={usersById[shift.userId] ?? 'Unassigned'}
                              canManage={canManage}
                              onEdit={onEditShift}
                              onDelete={onDeleteShift}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          )
        })}
      </div>
    </DragDropContext>
  )
}
