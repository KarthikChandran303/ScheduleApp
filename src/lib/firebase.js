import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getMessaging, isSupported as messagingIsSupported } from 'firebase/messaging';

// Replace with the values from Firebase Console > Project settings > General
// > Your apps > SDK setup and configuration.
// The SAME values also need to go into public/firebase-messaging-sw.js
// (service workers can't import this file, so it's duplicated there).
const firebaseConfig = {
  apiKey: 'AIzaSyColNN3Kd49mYUluLzQZcatpNw013i8DbQ',
  authDomain: 'scheduling-app-3e0ea.firebaseapp.com',
  projectId: 'scheduling-app-3e0ea',
  storageBucket: 'scheduling-app-3e0ea.firebasestorage.app',
  messagingSenderId: '893592505585',
  appId: '1:893592505585:web:a35f1d268defc2e3506d50',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Messaging isn't supported in every browser (e.g. desktop Safari) — guard it.
export async function getMessagingIfSupported() {
  if (await messagingIsSupported()) {
    return getMessaging(app);
  }
  return null;
}

// Get this from Firebase Console > Project settings > Cloud Messaging >
// Web configuration > Web Push certificates ("Generate key pair").
export const VAPID_KEY = 'BHaSZThJL_z34Sp-LeL7oAdd-TYCnOnPoVX0dvb-EchHjZUTEp3ORhWDJgP-N-6WbCalqiP1sHT9Ot3R7l-cV7s';
