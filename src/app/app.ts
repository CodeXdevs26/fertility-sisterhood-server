import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { swaggerRouter } from "./docs/swagger.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import routeNotFoundHandler from "./middlewares/routeNotFoundHandler.js";

const app: Application = express();

app.use(
  "/api/v1/subscriptions/webhook",
  express.raw({ type: "application/json" })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://10.10.28.34:3000",
      "http://72.244.153.29:3000",
    ],
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
