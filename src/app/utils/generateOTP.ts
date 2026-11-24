import crypto from "crypto";

/** 6-digit OTP from a CSPRNG (Math.random is predictable). */
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

export default generateOTP;
