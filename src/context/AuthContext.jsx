import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, db, getMessagingIfSupported, VAPID_KEY } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null); // Firestore users/{uid} doc

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        return;
      }
      const ref = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(ref);
      setProfile(snap.exists() ? { id: fbUser.uid, ...snap.data() } : null);
    });
  }, []);

  async function signup(email, password, name, requestedRole = 'general') {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // New accounts start "unassigned" — treated as view-only until an admin
    // promotes them to "scheduler" in the Firestore console.
    const ref = doc(db, 'users', cred.user.uid);
    await setDoc(ref, {
      name,
      email,
      role: 'unassigned',
      requestedRole: requestedRole === 'scheduler' ? 'scheduler' : 'general',
      requestStatus: requestedRole === 'scheduler' ? 'pending' : 'none',
      fcmToken: null,
      createdAt: serverTimestamp(),
    });
    setProfile({ id: cred.user.uid, name, role: 'unassigned', fcmToken: null });
    return cred.user;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  // Ask for notification permission and save the device's FCM token on the
  // user's profile so the backend job can push to it. Safe to call multiple
  // times (e.g. on every login) — it's a no-op if already granted+saved.
  async function registerPushToken() {
    if (!firebaseUser) return;
    const messaging = await getMessagingIfSupported();
    if (!messaging) return; // e.g. desktop Safari, or not installed on iOS
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      await updateDoc(doc(db, 'users', firebaseUser.uid), { fcmToken: token });
      setProfile((p) => (p ? { ...p, fcmToken: token } : p));
    }
  }

  const value = {
    firebaseUser,
    profile,
    isScheduler: profile?.role === 'scheduler',
    loading: firebaseUser === undefined,
    signup,
    login,
    logout,
    registerPushToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
