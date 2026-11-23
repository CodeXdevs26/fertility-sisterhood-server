import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { subscriptionServices } from "./subscription.service.js";

const getPlan = handleAsyncRequest(async (_req: TRequest, res: Response) => {
  const data = await subscriptionServices.getPlan();
  sendResponse(res, {
    message: "Subscription plan fetched successfully!",
    data,
  });
});

const updatePlan = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.updatePlan(req.body);
  sendResponse(res, {
    message: "Subscription plan updated successfully!",
    data,
  });
});

const purchase = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.purchase(req.user!.id);
  sendResponse(res, {
    status: 201,
    message: "Subscription initiated successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.getMy(req.user!.id);
  sendResponse(res, { message: "Subscription fetched successfully!", data });
});

const sync = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.sync(req.user!.id);
  sendResponse(res, { message: "Subscription synced successfully!", data });
});

const cancel = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.cancel(req.user!.id);
  sendResponse(res, { message: "Subscription canceled successfully!", data });
});

const renew = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.renew(req.user!.id);
  sendResponse(res, { message: "Subscription renewed successfully!", data });
});

const webhook = handleAsyncRequest(async (req: TRequest, res: Response) => {
  await subscriptionServices.handleWebhook(
    req.body,
    req.headers["stripe-signature"] as string
  );
  sendResponse(res, { message: "Webhook received successfully!", data: null });
});

export const subscriptionController = {
  getPlan,
  updatePlan,
  purchase,
  getMy,
  sync,
  cancel,
  renew,
  webhook,
};
