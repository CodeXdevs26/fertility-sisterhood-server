import { Router } from "express";
import validate from "../../middlewares/validate.js";
import {
  changeAccountStatusZod,
  changePasswordZod,
  googleLoginZod,
  loginZodSchema,
  resetPasswordZod,
  userSignupZod,
} from "./auth.validation.js";
import { authController } from "./auth.controller.js";
import authorize from "../../middlewares/authorize.js";
import { UserRole } from "@prisma/client";
import { authLimiter } from "../../middlewares/rateLimit.js";

const router = Router();

router.get("/refresh-token", authController.refreshToken);
router.get("/:id", authorize(UserRole.ADMIN), authController.getSingle);
router.get("/", authorize(UserRole.ADMIN), authController.getAll);
router.post(
  "/signup",
  authLimiter,
  validate(userSignupZod),
  authController.signup
);
router.post(
  "/login",
  authLimiter,
  validate(loginZodSchema),
  authController.login
);

router.post(
  "/google",
  authLimiter,
  validate(googleLoginZod),
  authController.googleLogin
);

router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordZod),
  authController.resetPassword
);

router.post(
  "/change-password",
  authLimiter,
  authorize(UserRole.ADMIN, UserRole.USER),
  validate(changePasswordZod),
  authController.changePassword
);

router.patch(
  "/change-account-status/:userId",
  authorize(UserRole.ADMIN),
  validate(changeAccountStatusZod),
  authController.changeAccountStatus
);

router.post(
  "/logout",
  authorize(UserRole.ADMIN, UserRole.USER),
  authController.logout
);

export const authRoutes = router;
