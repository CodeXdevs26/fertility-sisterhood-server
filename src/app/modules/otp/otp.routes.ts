import { Router } from "express";
import validate from "../../middlewares/validate.js";
import { otpLimiter } from "../../middlewares/rateLimit.js";
import { otpController } from "./otp.controller.js";
import { sendOtpZod, verifyOtpZod } from "./otp.validation.js";

const router = Router();

router.use(otpLimiter);
router.post("/send", validate(sendOtpZod), otpController.sendOtp);

router.post("/verify", validate(verifyOtpZod), otpController.verifyOtp);

export const otpRoutes = router;
