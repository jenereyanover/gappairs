// Firebase initialisation. Guarded so the app still runs (game, menu) even when
// no Firebase config is present — auth/db/rtdb are simply null and the UI degrades.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

/** True when the core Firebase env vars are present (auth + firestore). */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);
/** True when the Realtime Database URL is also configured (needed for online lobbies). */
export const rtdbEnabled = firebaseEnabled && Boolean(config.databaseURL);

let app: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;

if (firebaseEnabled) {
  app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  if (rtdbEnabled) rtdb = getDatabase(app);
}

export const googleProvider = new GoogleAuthProvider();
export { auth, db, rtdb };
