import rateLimit from "express-rate-limit";

const limitResponse = (message: string) => ({
  success: false,
  message,
  error: { statusCode: 429 },
});

/**
 * Credential endpoints (login, signup, reset/change password): slows down
 * password guessing. Keyed by client IP (`trust proxy` is configured in app.ts).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many attempts, please try again later!"),
});

/** OTP send / verify: stops OTP brute force and email bombing. */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many OTP requests, please try again later!"),
});
