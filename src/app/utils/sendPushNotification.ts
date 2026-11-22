import { getFirebaseMessaging } from "./firebase.js";
import prisma from "./prisma.js";

type TPushPayload = {
  authId: string;
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

/**
 * Sends a push notification via FCM. Returns true when sent.
 * Stale tokens are cleared from the user so they are not retried.
 */
export const sendPushNotification = async ({
  authId,
  token,
  title,
  body,
  data,
}: TPushPayload): Promise<boolean> => {
  const messaging = getFirebaseMessaging();
  if (!messaging) return false;

  try {
    await messaging.send({
      token,
      notification: { title, body },
      ...(data && { data }),
    });
    return true;
  } catch (error: any) {
    if (INVALID_TOKEN_CODES.includes(error?.code)) {
      await prisma.auth.update({
        where: { id: authId },
        data: { fcmToken: null },
      });
    } else {
      console.error("Push notification failed:", error?.message ?? error);
    }
    return false;
  }
};
