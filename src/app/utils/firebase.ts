import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import config from "../config/index.js";

let messaging: Messaging | null | undefined;

/** Lazily initialised FCM client. Returns null (and warns once) if Firebase env is missing. */
export const getFirebaseMessaging = (): Messaging | null => {
  if (messaging !== undefined) return messaging;

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase env is missing - push notifications are disabled.");
    messaging = null;
    return messaging;
  }

  const app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  messaging = getMessaging(app);
  return messaging;
};

/** FCM error codes meaning the device token is dead and should be removed. */
export const INVALID_FCM_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
