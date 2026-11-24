import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { swaggerRouter } from "./docs/swagger.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import routeNotFoundHandler from "./middlewares/routeNotFoundHandler.js";
import requestLogger from "./middlewares/requestLogger.js";
import config from "./config/index.js";

const app: Application = express();

// read the real client IP from X-Forwarded-For when the request comes through
// a trusted proxy (TRUST_PROXY, default "loopback"); others use the socket address
app.set("trust proxy", config.trustProxy);

app.use(requestLogger);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    // allow every origin; `true` reflects the request's Origin header,
    // which (unlike "*") still works with credentials: true
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Fertility Sisterhood server is running! 🚀",
  });
});

app.use(swaggerRouter);

app.use("/api/v1", router);

app.use(globalErrorHandler);
app.use(routeNotFoundHandler);

export default app;
