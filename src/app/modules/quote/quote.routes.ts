import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { quoteController } from "./quote.controller.js";
import { createQuoteZod, updateQuoteZod } from "./quote.validation.js";

const router = Router();
const admin = authorize(UserRole.ADMIN);

router.get("/today", quoteController.getToday);
router.get("/", admin, quoteController.getAll);
router.post("/", admin, validate(createQuoteZod), quoteController.create);
router.patch("/:id", admin, validate(updateQuoteZod), quoteController.update);
router.delete("/:id", admin, quoteController.remove);

export const quoteRoutes = router;
