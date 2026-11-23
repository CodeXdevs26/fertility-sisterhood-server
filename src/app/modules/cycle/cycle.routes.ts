import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { cycleController } from "./cycle.controller.js";
import {
  createCycleZod,
  cycleMonthQueryZod,
  updateCycleZod,
} from "./cycle.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post("/", validate(createCycleZod), cycleController.create);
router.get("/", cycleController.getMy);
router.get(
  "/by-date",
  validate(cycleMonthQueryZod, { query: true }),
  cycleController.getByDate
);
router.patch("/:id", validate(updateCycleZod), cycleController.update);
router.delete("/:id", cycleController.remove);

export const cycleRoutes = router;
