import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { noteController } from "./note.controller.js";
import { createNoteZod, updateNoteZod } from "./note.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post("/", validate(createNoteZod), noteController.create);
router.get("/", noteController.getMy);
router.patch("/:id", validate(updateNoteZod), noteController.update);
router.delete("/:id", noteController.remove);

export const noteRoutes = router;
