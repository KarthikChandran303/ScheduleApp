import type { Role } from '../types'

export const canManageShifts = (role?: Role | null) => role === 'admin' || role === 'manager'

export const isAdmin = (role?: Role | null) => role === 'admin'

export const hasRequiredRole = (role: Role | null | undefined, allowedRoles?: Role[]) => {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  return role ? allowedRoles.includes(role) : false
}
