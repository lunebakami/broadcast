import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

export const emulatorsEnabled = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const functionsEnabled = import.meta.env.VITE_ENABLE_FUNCTIONS === 'true';

const config = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY || (emulatorsEnabled ? 'demo-api-key' : ''),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (emulatorsEnabled ? 'localhost' : ''),
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (emulatorsEnabled ? 'demo-broadcast' : ''),
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID || (emulatorsEnabled ? 'demo-app-id' : ''),
};
export const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app
  ? getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
  : null;

if (emulatorsEnabled && auth && db && functions) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
