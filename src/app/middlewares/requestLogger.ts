import { NextFunction, Request, Response } from "express";

/** Strips the IPv4-mapped IPv6 prefix ("::ffff:127.0.0.1" -> "127.0.0.1"). */
const normalizeIp = (ip?: string) => {
  if (!ip) return "unknown";
  if (ip === "::1") return "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

/**
 * Logs one line per request once the response is sent:
 * time, client IP, method, URL, status, duration.
 * When the client IP came from a trusted X-Forwarded-For header, the proxy's
 * own address is appended as "(via <proxy>)".
 */
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const socketIp = normalizeIp(req.socket.remoteAddress);
    const clientIp = normalizeIp(req.ip ?? req.socket.remoteAddress);
    const via = clientIp !== socketIp ? ` (via ${socketIp})` : "";

    console.log(
      `[${new Date().toISOString()}] ${clientIp}${via} ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(1)}ms`
    );
  });

  next();
};

export default requestLogger;
