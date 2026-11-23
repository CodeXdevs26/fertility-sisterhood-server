import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { subscriptionController } from "./subscription.controller.js";
import { updateSubscriptionPlanZod } from "./subscription.validation.js";

const router = Router();

router.post("/webhook", subscriptionController.webhook);
router.get(
  "/plan",
  authorize(UserRole.ADMIN, UserRole.USER),
  subscriptionController.getPlan
);
router.patch(
  "/plan",
  authorize(UserRole.ADMIN),
  validate(updateSubscriptionPlanZod),
  subscriptionController.updatePlan
);
router.post(
  "/purchase",
  authorize(UserRole.USER),
  subscriptionController.purchase
);
router.get("/my", authorize(UserRole.USER), subscriptionController.getMy);
router.post("/sync", authorize(UserRole.USER), subscriptionController.sync);
router.patch(
  "/cancel",
  authorize(UserRole.USER),
  subscriptionController.cancel
);
router.patch("/renew", authorize(UserRole.USER), subscriptionController.renew);

export const subscriptionRoutes = router;
