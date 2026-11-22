import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import config from "../config/index.js";

let messaging: Messaging | null = null;

/** Returns the FCM client, or null when Firebase credentials are not configured. */
export const getFirebaseMessaging = (): Messaging | null => {
  if (messaging) return messaging;

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) return null;

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

  messaging = getMessaging(app);
  return messaging;
};
