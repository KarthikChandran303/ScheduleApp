import { fireEvent, render, screen } from '@testing-library/react'
import ShiftCard from '../components/ShiftCard'
import type { Shift } from '../types'

const shift: Shift = {
  id: 'shift-1',
  title: 'Opening Shift',
  userId: 'user-1',
  date: '2026-08-17',
  startTime: '08:00',
  endTime: '16:00',
  color: '#2563eb',
  notes: 'Stock front display before store opens.'
}

describe('ShiftCard', () => {
  it('renders shift details', () => {
    render(
      <ShiftCard
        shift={shift}
        userName="Alex Johnson"
        canManage={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Opening Shift')).toBeInTheDocument()
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument()
    expect(screen.getByText(/Stock front display/)).toBeInTheDocument()
  })

  it('shows action buttons only for managers and admins', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    const { rerender } = render(
      <ShiftCard shift={shift} userName="Alex Johnson" canManage={false} onEdit={onEdit} onDelete={onDelete} />
    )

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    rerender(
      <ShiftCard shift={shift} userName="Alex Johnson" canManage onEdit={onEdit} onDelete={onDelete} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onEdit).toHaveBeenCalledWith(shift)
    expect(onDelete).toHaveBeenCalledWith('shift-1')
  })
})
