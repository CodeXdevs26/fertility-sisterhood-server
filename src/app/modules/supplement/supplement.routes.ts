import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { supplementController } from "./supplement.controller.js";
import {
  createSupplementZod,
  updateSupplementZod,
} from "./supplement.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post("/", validate(createSupplementZod), supplementController.create);
router.get("/", supplementController.getMy);
router.patch("/:id/taken", supplementController.markTakenToday);
router.get("/:id", supplementController.getSingle);
router.patch(
  "/:id",
  validate(updateSupplementZod),
  supplementController.update
);
router.delete("/:id", supplementController.remove);

export const supplementRoutes = router;
