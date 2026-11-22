import { NextFunction, Request, Response } from "express";

/** Strips the IPv4-mapped IPv6 prefix ("::ffff:127.0.0.1" -> "127.0.0.1"). */
const normalizeIp = (ip?: string) => {
  if (!ip) return "unknown";
  if (ip === "::1") return "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

/** Logs one line per request once the response is sent: time, IP, method, URL, status, duration. */
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(
      `[${new Date().toISOString()}] ${normalizeIp(req.ip ?? req.socket.remoteAddress)} ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(1)}ms`
    );
  });

  next();
};

export default requestLogger;
