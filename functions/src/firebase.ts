import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

const runningInEmulator =
  process.env.FUNCTIONS_EMULATOR === 'true' ||
  process.env.GCLOUD_PROJECT?.startsWith('demo-') === true;

if (runningInEmulator) {
  process.env.CLOUD_TASKS_EMULATOR_HOST ??= '127.0.0.1:9499';
}

initializeApp(
  runningInEmulator
    ? {
        projectId: process.env.GCLOUD_PROJECT,
        serviceAccountId: 'emulated-service-acct@email.com',
      }
    : undefined,
);

export const region = 'us-central1';
setGlobalOptions({ region, maxInstances: 10 });
export const db = getFirestore();
