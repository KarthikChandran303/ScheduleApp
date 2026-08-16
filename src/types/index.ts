export type Role = 'admin' | 'manager' | 'employee'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: Role
}

export interface Shift {
  id: string
  title: string
  userId: string
  date: string
  startTime: string
  endTime: string
  color: string
  notes?: string
}
