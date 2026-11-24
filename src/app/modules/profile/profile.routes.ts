import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import { profileController } from "./profile.controller.js";
import validate from "../../middlewares/validate.js";
import { authLimiter } from "../../middlewares/rateLimit.js";
import {
  deleteAccountZod,
  profileUpdateZod,
  updateConsentZod,
} from "./profile.validation.js";

const router = Router();

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.USER),
  profileController.getProfile
);
router.patch(
  "/",
  authorize(UserRole.ADMIN, UserRole.USER),
  validate(profileUpdateZod),
  profileController.updateProfile
);

// permanent self-service deletion (UK GDPR); password-confirmed
router.delete(
  "/",
  authLimiter,
  authorize(UserRole.USER),
  validate(deleteAccountZod),
  profileController.deleteAccount
);

router.patch(
  "/consent",
  authorize(UserRole.USER),
  validate(updateConsentZod),
  profileController.updateConsent
);

export const profileRoutes = router;
