import { canManageShifts, hasRequiredRole, isAdmin } from '../utils/permissions'

describe('role access helpers', () => {
  it('grants shift management to admins and managers only', () => {
    expect(canManageShifts('admin')).toBe(true)
    expect(canManageShifts('manager')).toBe(true)
    expect(canManageShifts('employee')).toBe(false)
  })

  it('detects admin role correctly', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('manager')).toBe(false)
  })

  it('checks role requirements safely', () => {
    expect(hasRequiredRole('admin', ['admin'])).toBe(true)
    expect(hasRequiredRole('employee', ['admin', 'manager'])).toBe(false)
    expect(hasRequiredRole(undefined, undefined)).toBe(true)
  })
})
