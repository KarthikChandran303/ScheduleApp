import type { Role, UserProfile } from '../types'

interface UserManagementPanelProps {
  users: UserProfile[]
  onRoleChange: (uid: string, role: Role) => Promise<void>
}

const roleOptions: Role[] = ['admin', 'manager', 'employee']

export default function UserManagementPanel({ users, onRoleChange }: UserManagementPanelProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-slate-950/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">User management</h2>
          <p className="mt-1 text-sm text-slate-400">
            Admins can update workspace permissions for every team member.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {users.map((user) => (
          <div
            key={user.uid}
            className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-medium text-white">{user.displayName}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <span>Role</span>
              <select
                aria-label={`Role for ${user.displayName}`}
                className="w-40"
                value={user.role}
                onChange={(event) => onRoleChange(user.uid, event.target.value as Role)}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </section>
  )
}
