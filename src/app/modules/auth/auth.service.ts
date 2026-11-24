import {
  LoginProvider,
  NotificationModelType,
  OTPPurpose,
  Prisma,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import crypto from "crypto";
import ApiError from "../../classes/ApiError.js";
import {
  createNotification,
  notify,
} from "../notification/notification.utils.js";
import prisma from "../../utils/prisma.js";
import { sendEmail } from "../../utils/sendEmail.js";
import {
  TChangePasswordInput,
  TLoginInput,
  TResetPasswordInput,
  TSignup,
} from "./auth.validation.js";
import bcrypt from "bcrypt";
import jsonwebtoken, { Secret } from "jsonwebtoken";
import config from "../../config/index.js";
import jwt from "jsonwebtoken";
import { TAuthUser } from "../../interface/global.interface.js";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import generateOTP from "../../utils/generateOTP.js";

const signUp = async (payload: TSignup) => {
  const existingUser = await prisma.auth.findUnique({
    where: {
      email: payload.email,
      status: { not: UserStatus.PENDING },
    },
  });

  if (existingUser) throw new ApiError(400, "User already exists!");

  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const authData = {
    email: payload.email,
    name: payload.name,
    password: hashedPassword,
    role: UserRole.USER,
    status: UserStatus.PENDING,
    loginProvider: LoginProvider.EMAIL,
  };

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 2 * 60 * 1000);

  const result = await prisma.$transaction(async tn => {
    const result = await tn.auth.upsert({
      where: {
        email: payload.email,
      },
      create: authData,
      update: authData,
    });

    const otpData = {
      authId: result.id,
      otp: hashedOtp,
      expires: otpExpires,
      attempts: 0,
      isVerified: false,
      purpose: OTPPurpose.VERIFY_ACCOUNT,
    };

    await tn.oTP.upsert({
      where: {
        authId: result.id,
      },
      update: otpData,
      create: otpData,
    });
    return result;
  });

  // sendEmail
  if (result) {
    const subject = "Complete your signup – Fertility Sisterhood";
    const replacements = {
      otp,
      name: payload.name,
    };
    const path = "./src/app/emailTemplates/welcome.html";
    sendEmail(payload.email, subject, path, replacements);
  }

  return {
    id: result.id,
    email: result.email,
    name: result.name,
    role: result.role,
    status: result.status,
    createdAt: result.createdAt,
  };
};

const login = async (payload: TLoginInput) => {
  const auth = await prisma.auth.findUnique({
    where: {
      email: payload.email,
      NOT: [
        {
          status: UserStatus.DELETED,
        },
      ],
    },
  });

  if (!auth) {
    throw new ApiError(400, "Invalid email or password!");
  }

  if (auth.status === UserStatus.PENDING)
    throw new ApiError(400, "Please verify your account!");

  if (auth.status === UserStatus.BLOCKED)
    throw new ApiError(400, "Your account is blocked!");

  if (auth.loginProvider === LoginProvider.GOOGLE)
    throw new ApiError(400, "Your account was created using Google!");

  const hasMatched = await bcrypt.compare(payload.password, auth.password);
  if (!hasMatched) throw new ApiError(400, "Invalid email or password!");

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

  const refreshToken = jsonwebtoken.sign(
    jwtPayload,
    config.jwt.refreshSecret as Secret,
    {
      expiresIn: config.jwt.refreshExpiration as any,
    }
  );

  // save the device's fcmToken / timezone. A device token belongs to one
  // account at a time, so remove it from whoever logged in on this device before.
  if (payload.fcmToken || payload.timezone) {
    await prisma.$transaction([
      ...(payload.fcmToken
        ? [
            prisma.auth.updateMany({
              where: { fcmToken: payload.fcmToken, id: { not: auth.id } },
              data: { fcmToken: null },
            }),
          ]
        : []),
      prisma.auth.update({
        where: { id: auth.id },
        data: {
          ...(payload.fcmToken ? { fcmToken: payload.fcmToken } : {}),
          ...(payload.timezone ? { timezone: payload.timezone } : {}),
        },
      }),
    ]);
  }

  return {
    accessToken,
    refreshToken,
  };
};

const getAll = async (
  options: TPaginationOptions,
  query: Record<string, any>
) => {
  const andConditions: Prisma.AuthWhereInput[] = [];
  const requestedRoles = Array.isArray(query.role)
    ? query.role
    : typeof query.role === "string"
      ? query.role
          .split(",")
          .map((role: string) => role.trim())
          .filter(Boolean)
      : [];

  andConditions.push({
    OR: [
      {
        role: UserRole.USER,
      },
    ],
    status: { in: [UserStatus.ACTIVE, UserStatus.BLOCKED] },
  });

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          email: { contains: query.searchTerm, mode: "insensitive" },
        },
        {
          name: { contains: query.searchTerm, mode: "insensitive" },
        },
      ],
    });
  }

  if (requestedRoles.length > 0) {
    andConditions.push({
      role: {
        in: requestedRoles,
      },
    });
  }

  const status = String(query.status || "").toUpperCase();
  if (status === UserStatus.ACTIVE || status === UserStatus.BLOCKED) {
    andConditions.push({ status });
  }

  const activeSubscription: Prisma.AuthWhereInput = {
    subscription: { is: { status: SubscriptionStatus.ACTIVE } },
  };
  const subscription = String(query.subscription || "").toLowerCase();
  if (subscription === "premium") andConditions.push(activeSubscription);
  else if (subscription === "free")
    andConditions.push({ NOT: activeSubscription });

  const whereConditions: Prisma.AuthWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const { page, take, skip, sortBy, orderBy } = calculatePagination(options);
  const users = await prisma.auth.findMany({
    where: whereConditions,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      subscription: { select: { status: true } },
    },
    skip,
    take,
    orderBy: sortBy && orderBy ? { [sortBy]: orderBy } : { createdAt: "desc" },
  });

  const total = await prisma.auth.count({
    where: whereConditions,
  });

  const auths = users.map(({ subscription, ...user }) => ({
    ...user,
    isPremium: subscription?.status === SubscriptionStatus.ACTIVE,
  }));

  const meta = {
    page,
    limit: take,
    total,
  };
  return { meta, auths };
};

const getSingle = async (id: string) => {
  const auth = await prisma.auth.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      loginProvider: true,
      consent: {
        select: {
          healthData: true,
          healthDataUpdatedAt: true,
          marketing: true,
          cookies: true,
        },
      },
      createdAt: true,
      subscription: {
        select: {
          status: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      },
    },
  });
  if (!auth) throw new ApiError(404, "User not found");

  const { loginProvider, consent, ...rest } = auth;
  return {
    ...rest,
    isPremium: auth.subscription?.status === SubscriptionStatus.ACTIVE,
    provider: loginProvider,
    consent: consent ?? null,
  };
};

const resetPassword = async (payload: TResetPasswordInput) => {
  const auth = await prisma.auth.findUniqueOrThrow({
    where: {
      email: payload.email,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      tokenVersion: true,
    },
  });

  const otp = await prisma.oTP.findFirstOrThrow({
    where: {
      authId: auth.id,
      isVerified: true,
      purpose: OTPPurpose.RESET_PASSWORD,
    },
  });

  if (!otp) throw new ApiError(401, "OTP is not verified!");
  if (!otp.resetTokenHash || !otp.resetTokenExpires)
    throw new ApiError(401, "Reset token is missing!");

  const hashedToken = crypto
    .createHash("sha256")
    .update(payload.resetToken)
    .digest("hex");

  if (otp.resetTokenHash !== hashedToken)
    throw new ApiError(401, "Invalid reset token!");

  if (otp.resetTokenExpires < new Date())
    throw new ApiError(401, "Reset token has expired!");

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  await prisma.$transaction(async tn => {
    await tn.auth.update({
      where: {
        email: payload.email,
      },
      data: {
        password: hashedPassword,
        // log out every device: old tokens may belong to whoever knew the old password
        tokenVersion: (auth.tokenVersion ?? 0) + 1,
      },
    });

    await tn.oTP.delete({
      where: {
        authId: auth.id,
      },
    });
  });

  // send email
  const subject = "Your Password Has Been Reset - Fertility Sisterhood";
  const path = "./src/app/emailTemplates/passwordResetSuccess.html";
  const replacements = {
    name: auth.name || "there",
  };
  sendEmail(payload.email, subject, path, replacements);
};

const changePassword = async (
  payload: TChangePasswordInput,
  userId: string
) => {
  const auth = await prisma.auth.findUniqueOrThrow({
    where: {
      id: userId,
      status: UserStatus.ACTIVE,
    },
  });

  const hasMatched = await bcrypt.compare(payload.oldPassword, auth.password);
  if (!hasMatched) {
    throw new ApiError(400, "Old password is incorrect!");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

  // other devices are logged out (tokenVersion bump); this device gets new tokens
  const updated = await prisma.auth.update({
    where: {
      id: userId,
    },
    data: {
      password: hashedPassword,
      tokenVersion: (auth.tokenVersion ?? 0) + 1,
    },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  const jwtPayload = {
    email: updated.email,
    role: updated.role,
    id: updated.id,
    tv: updated.tokenVersion ?? 0,
  };
  return {
    accessToken: jsonwebtoken.sign(
      jwtPayload,
      config.jwt.accessSecret as Secret,
      {
        expiresIn: config.jwt.accessExpiration as any,
      }
    ),
    refreshToken: jsonwebtoken.sign(
      jwtPayload,
      config.jwt.refreshSecret as Secret,
      { expiresIn: config.jwt.refreshExpiration as any }
    ),
  };
};

const changeAccountStatus = async (userId: string, status: UserStatus) => {
  const auth = await prisma.auth.findUniqueOrThrow({
    where: {
      id: userId,
    },
  });
  if (auth.role === UserRole.ADMIN)
    throw new ApiError(400, "Admin account cannot be changed!");

  const isBlocking =
    status === UserStatus.BLOCKED && auth.status !== UserStatus.BLOCKED;
  const isActivating =
    status === UserStatus.ACTIVE && auth.status !== UserStatus.ACTIVE;

  // must be pushed BEFORE blocking: the update below clears the fcmToken
  // and pushes only go to ACTIVE accounts
  if (isBlocking) {
    await createNotification({
      receiverId: userId,
      message: "Your account has been blocked",
      description:
        "You can no longer use Fertility Sisterhood. Please contact support if you think this is a mistake.",
      modelType: NotificationModelType.ACCOUNT,
    }).catch(error =>
      console.error("Failed to send block notification:", error)
    );
  }

  await prisma.auth.update({
    where: {
      id: userId,
    },
    data: {
      status: status,
      // blocked / deleted accounts must not receive pushes, and lose every
      // issued token at once
      ...(status !== UserStatus.ACTIVE
        ? { fcmToken: null, tokenVersion: (auth.tokenVersion ?? 0) + 1 }
        : {}),
    },
  });

  if (isActivating) {
    notify({
      receiverId: userId,
      message: "Your account has been activated",
      description: "Welcome back! You can use Fertility Sisterhood again.",
      modelType: NotificationModelType.ACCOUNT,
    });
  }

  const message =
    status === UserStatus.ACTIVE
      ? "Account activated successfully!"
      : status === UserStatus.BLOCKED
        ? "Account blocked successfully!"
        : status === UserStatus.DELETED
          ? "Account deleted successfully!"
          : "";
  return { message };
};

const refreshToken = async (token: string) => {
  if (!token) throw new ApiError(401, "Unauthorized!");
  const decodedUser = jwt.verify(token, config.jwt.refreshSecret as Secret);
  if (!decodedUser) throw new ApiError(401, "Unauthorized!");

  // blocked / deleted accounts must not keep minting access tokens
  const user = await prisma.auth.findFirst({
    where: {
      id: (decodedUser as TAuthUser).id,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      role: true,
      tokenVersion: true,
    },
  });
  // a password change / reset or block bumps tokenVersion: old refresh tokens die
  if (
    !user ||
    (user.tokenVersion ?? 0) !== ((decodedUser as TAuthUser).tv ?? 0)
  )
    throw new ApiError(401, "Unauthorized!");

  const jwtPayload = {
    email: user.email,
    role: user.role,
    id: user.id,
    tv: user.tokenVersion ?? 0,
  };

  const accessToken = jwt.sign(jwtPayload, config.jwt.accessSecret as Secret, {
    expiresIn: config.jwt.accessExpiration as any,
  });

  return { accessToken };
};

const logout = async (userId: string) => {
  // stop push notifications to this device
  await prisma.auth.updateMany({
    where: { id: userId },
    data: { fcmToken: null },
  });
};

export const authServices = {
  logout,
  signUp,
  login,
  getSingle,
  getAll,
  refreshToken,
  resetPassword,
  changePassword,
  changeAccountStatus,
};
