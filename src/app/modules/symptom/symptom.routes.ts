import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { symptomController } from "./symptom.controller.js";
import {
  createSymptomZod,
  symptomTodayQueryZod,
  updateSymptomZod,
} from "./symptom.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post("/", validate(createSymptomZod), symptomController.create);
router.get(
  "/today",
  validate(symptomTodayQueryZod, { query: true }),
  symptomController.getToday
);
router.get("/", symptomController.getMy);
router.patch("/:id", validate(updateSymptomZod), symptomController.update);
router.delete("/:id", symptomController.remove);

export const symptomRoutes = router;
