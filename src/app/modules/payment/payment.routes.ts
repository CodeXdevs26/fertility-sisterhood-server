import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import { paymentController } from "./payment.controller.js";

const router = Router();
router.get("/", authorize(UserRole.ADMIN), paymentController.getAll);

export const paymentRoutes = router;
