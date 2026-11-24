import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { subscriptionController } from "./subscription.controller.js";
import { testPurchaseZod } from "./subscription.validation.js";

const router = Router();
const user = authorize(UserRole.USER);

// called by RevenueCat; authenticated by the Authorization header value
router.post("/webhook/revenuecat", subscriptionController.revenueCatWebhook);
router.get("/my", user, subscriptionController.getMy);
router.post("/sync/revenuecat", user, subscriptionController.sync);
// non-production only (the service returns 404 in production)
router.post(
  "/test-purchase",
  user,
  validate(testPurchaseZod),
  subscriptionController.testPurchase
);

export const subscriptionRoutes = router;
