import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Role } from '../types'
import { hasRequiredRole } from '../utils/permissions'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: Role[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, loading, userProfile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-200">
        Loading schedule workspace...
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!hasRequiredRole(userProfile?.role, allowedRoles)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-amber-400/30 bg-slate-900/90 p-8 text-center text-slate-200 shadow-2xl shadow-slate-950/40">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your current role does not allow access to this section.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
