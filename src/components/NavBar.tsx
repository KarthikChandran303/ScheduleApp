import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const roleBadgeStyles = {
  admin: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30',
  manager: 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30',
  employee: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30'
}

export default function NavBar() {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-300/80">ScheduleApp</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Team scheduling hub</h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 shadow-lg shadow-slate-950/20">
            <p className="font-medium text-white">{userProfile?.displayName ?? 'Signed in'}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>{userProfile?.email}</span>
              {userProfile?.role ? (
                <span className={`rounded-full px-2.5 py-1 font-semibold capitalize ${roleBadgeStyles[userProfile.role]}`}>
                  {userProfile.role}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
