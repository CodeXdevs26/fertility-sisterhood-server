import { NotificationModelType, OTPPurpose, UserStatus } from "@prisma/client";
import generateOTP from "../../utils/generateOTP.js";
import { notifyAdmins } from "../notification/notification.utils.js";
import prisma from "../../utils/prisma.js";
import { sendEmail } from "../../utils/sendEmail.js";
import ApiError from "../../classes/ApiError.js";
import bcrypt from "bcrypt";
import { TVerifyOtpInput } from "./otp.validation.js";
import crypto from "crypto";
import jsonwebtoken, { Secret } from "jsonwebtoken";
import config from "../../config/index.js";

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 4;

/**
 * VERIFY_ACCOUNT is only for accounts still waiting for verification, and
 * RESET_PASSWORD only for active ones. Without this a BLOCKED or DELETED user
 * could re-activate themselves through VERIFY_ACCOUNT.
 */
const assertStatusAllowed = (status: UserStatus, purpose: OTPPurpose) => {
  if (status === UserStatus.BLOCKED || status === UserStatus.DELETED) {
    throw new ApiError(403, "This account is not available!");
  }
  if (purpose === OTPPurpose.VERIFY_ACCOUNT && status !== UserStatus.PENDING) {
    throw new ApiError(400, "Account is already verified!");
  }
  if (purpose === OTPPurpose.RESET_PASSWORD && status !== UserStatus.ACTIVE) {
    throw new ApiError(400, "Please verify your account first!");
  }
};

const sendOtp = async (
  email: string,
  purpose: OTPPurpose = OTPPurpose.VERIFY_ACCOUNT
) => {
  const auth = await prisma.auth.findUniqueOrThrow({
    where: {
      email: email,
    },
    select: {
      id: true,
      name: true,
      status: true,
      otp: { select: { expires: true } },
    },
  });
  assertStatusAllowed(auth.status, purpose);

  // `expires` is set to now + TTL on every send, so it tells when the last OTP went out
  const lastSentAt = auth.otp ? auth.otp.expires.getTime() - OTP_TTL_MS : 0;
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
    throw new ApiError(
      429,
      "Please wait a minute before requesting a new OTP!"
    );
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  const otpData = {
    authId: auth.id,
    otp: hashedOtp,
    expires: otpExpires,
    attempts: 0,
    isVerified: false,
    purpose,
  };

  await prisma.oTP.upsert({
    where: {
      authId: auth.id,
    },
    update: otpData,
    create: otpData,
  });

  // send email
  const subject = "Your One-Time Password (OTP) - Fertility Sisterhood";
  const path = "./src/app/emailTemplates/otp.html";
  sendEmail(email, subject, path, {
    otp,
    name: auth.name || "there",
  });
};

const verifyOtp = async (payload: TVerifyOtpInput) => {
  const purpose = payload.purpose;

  const auth = await prisma.auth.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });
  assertStatusAllowed(auth.status, purpose);

  const otp = await prisma.oTP.findFirstOrThrow({
    where: {
      authId: auth.id,
      isVerified: false,
      purpose,
    },
  });

  const hasOtpExpired = otp.expires < new Date();

  if (hasOtpExpired) {
    throw new ApiError(400, "OTP expired! Please request a new one!");
  }

  // Count the attempt atomically BEFORE comparing, so parallel requests
  // cannot all pass a stale "attempts" check and get extra guesses.
  const counted = await prisma.oTP.updateMany({
    where: {
      authId: auth.id,
      isVerified: false,
      purpose,
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });
  if (counted.count === 0)
    throw new ApiError(400, "Too many attempts! Please request a new one!");

  const hasMatched = await bcrypt.compare(payload.otp, otp.otp);
  if (!hasMatched) {
    throw new ApiError(400, "Invalid OTP! Please try again!");
  }

  const result = await prisma.$transaction(async tn => {
    if (purpose === OTPPurpose.VERIFY_ACCOUNT) {
      const updatedAuth = await tn.auth.update({
        where: {
          email: payload.email,
        },
        data: {
          status: UserStatus.ACTIVE,
        },
      });

      await tn.oTP.delete({
        where: {
          authId: auth.id,
        },
      });

      // send verification success email
      if (updatedAuth) {
        const subject =
          "Welcome to Fertility Sisterhood! Your Email is Verified";
        const name = updatedAuth.name || "there";
        const path = "./src/app/emailTemplates/verificationSuccess.html";
        sendEmail(updatedAuth.email, subject, path, { name });

        notifyAdmins({
          message: "New user",
          description: `${updatedAuth.name} (${updatedAuth.email}) joined Fertility Sisterhood`,
          modelType: NotificationModelType.NEW_USER,
          referenceId: updatedAuth.id,
          dedupeKey: `admin-new-user:${updatedAuth.id}`,
        });
      }

      // prepare tokens
      const jwtPayload = {
        email: auth.email,
        role: auth.role,
        id: auth.id,
        tv: auth.tokenVersion ?? 0,
      };

      const accessToken = jsonwebtoken.sign(
        jwtPayload,
        config.jwt.accessSecret as Secret,
        {
          expiresIn: config.jwt.accessExpiration as any,
        }
      );

      return { accessToken };
    } else {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);

      await tn.oTP.update({
        where: {
          authId: auth.id,
        },
        data: {
          isVerified: true,
          resetTokenHash: tokenHash,
          resetTokenExpires: tokenExpires,
        },
      });

      return { resetToken: token };
    }
  });

  return result;
};

export const otpServices = {
  verifyOtp,
  sendOtp,
};
