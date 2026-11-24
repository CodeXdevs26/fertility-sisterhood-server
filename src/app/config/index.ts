import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 5003,
  // Express "trust proxy" value: which proxy addresses may set X-Forwarded-For
  trustProxy: process.env.TRUST_PROXY || "loopback",
  email: {
    emailSendingApi: process.env.SEND_EMAIL_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION,
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  aws: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY,
    s3BaseUrl: process.env.S3_BASE_URL,
    s3_api: process.env.S3_API,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_BUCKET_NAME,
  },
  revenueCat: {
    // secret (v1) REST API key, used to read subscriber state
    apiKey: process.env.REVENUECAT_API_KEY,
    // value RevenueCat sends in the webhook Authorization header
    webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET,
    // POST /subscriptions/test-purchase grants free Premium: opt-in only, and
    // never in production (a missing NODE_ENV must not enable it)
    enableTestPurchase:
      process.env.ENABLE_TEST_PURCHASE === "true" &&
      process.env.NODE_ENV !== "production",
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
};
