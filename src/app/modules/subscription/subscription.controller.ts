import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { subscriptionServices } from "./subscription.service.js";
import { TTestPurchase } from "./subscription.validation.js";

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.getMy(req.user!.id);
  sendResponse(res, { message: "Subscription fetched successfully!", data });
});

const sync = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await subscriptionServices.sync(req.user!.id);
  sendResponse(res, { message: "Subscription synced successfully!", data });
});

const testPurchase = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const { packageId } = req.body as TTestPurchase;
    const data = await subscriptionServices.testPurchase(
      req.user!.id,
      packageId
    );
    sendResponse(res, {
      status: 201,
      message: "Test purchase completed successfully!",
      data,
    });
  }
);

const revenueCatWebhook = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    await subscriptionServices.handleRevenueCatWebhook(
      req.headers.authorization,
      req.body
    );
    sendResponse(res, {
      message: "Webhook received successfully!",
      data: null,
    });
  }
);

export const subscriptionController = {
  getMy,
  sync,
  testPurchase,
  revenueCatWebhook,
};
