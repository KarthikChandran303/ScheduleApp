import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { UserProfile } from '../types'

interface AuthContextValue {
  currentUser: User | null
  userProfile: UserProfile | null
  loading: boolean
  logout: () => Promise<void>
  refreshUserProfile: (uid?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const buildDefaultProfile = (user: User): UserProfile => ({
  uid: user.uid,
  email: user.email ?? '',
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Employee',
  role: 'employee'
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUserProfile = async (uid?: string) => {
    if (!uid) {
      setUserProfile(null)
      return
    }

    const snapshot = await getDoc(doc(db, 'users', uid))
    setUserProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)

      if (!user) {
        setUserProfile(null)
        setLoading(false)
        return
      }

      const userRef = doc(db, 'users', user.uid)
      const snapshot = await getDoc(userRef)

      if (!snapshot.exists()) {
        const profile = buildDefaultProfile(user)
        await setDoc(userRef, profile)
        setUserProfile(profile)
      } else {
        setUserProfile(snapshot.data() as UserProfile)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      userProfile,
      loading,
      logout: () => signOut(auth),
      refreshUserProfile
    }),
    [currentUser, loading, userProfile, refreshUserProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}
