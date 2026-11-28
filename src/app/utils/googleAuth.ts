import ApiError from "../classes/ApiError.js";
import config from "../config/index.js";

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

type TGoogleTokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
};

export type TGoogleProfile = { sub: string; email: string; name?: string };

/**
 * Verifies a Google ID token (from the iOS / Android / web Google Sign-In SDK)
 * with Google's tokeninfo endpoint, which checks the signature and expiry.
 * The audience must be one of GOOGLE_CLIENT_IDS and the email verified.
 */
export const verifyGoogleIdToken = async (
  idToken: string
): Promise<TGoogleProfile> => {
  const clientIds = config.google.clientIds;
  if (!clientIds.length)
    throw new ApiError(503, "Google sign-in is not available yet.");

  let response: Response;
  try {
    response = await fetch(
      `${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
  } catch {
    throw new ApiError(
      503,
      "Could not reach Google to verify your sign-in. Please try again."
    );
  }
  if (!response.ok)
    throw new ApiError(401, "Google sign-in failed. Please try again.");

  const info = (await response.json()) as TGoogleTokenInfo;
  const emailVerified =
    info.email_verified === true || info.email_verified === "true";

  if (
    !info.aud ||
    !clientIds.includes(info.aud) ||
    !info.iss ||
    !GOOGLE_ISSUERS.has(info.iss) ||
    !info.sub ||
    !info.email ||
    Number(info.exp) * 1000 < Date.now()
  )
    throw new ApiError(401, "Google sign-in failed. Please try again.");
  if (!emailVerified)
    throw new ApiError(
      400,
      "Your Google email address is not verified. Please verify it with Google first."
    );

  return {
    sub: info.sub,
    email: info.email.trim().toLowerCase(),
    name: info.name,
  };
};
