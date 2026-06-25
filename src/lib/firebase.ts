import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import appletConfig from "../../firebase-applet-config.json";

// Initialize using environment variables if provided, otherwise fallback to applet config
const firebaseConfig = import.meta.env.VITE_FIREBASE_API_KEY
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
    }
  : appletConfig;

let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error("Firebase Init Error", error);
  app = initializeApp(firebaseConfig);
}

let db: any;
let auth: any;
try {
  // Pass databaseId if using appletConfig fallback
  const dbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
  db = getFirestore(app, dbId);
  auth = getAuth(app);
} catch (e) {
  console.error("Firebase get auth/db error", e);
}

const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };
