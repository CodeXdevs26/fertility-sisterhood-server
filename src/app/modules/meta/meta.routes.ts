import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import { metaController } from "./meta.controller.js";

const router = Router();
router.use(authorize(UserRole.ADMIN));
router.get("/stats", metaController.getStats);
router.get("/user-overview", metaController.getUserOverview);

export const metaRoutes = router;
