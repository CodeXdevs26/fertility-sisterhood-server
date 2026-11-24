import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { packageServices } from "./package.service.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await packageServices.create(req.body);
  sendResponse(res, {
    status: 201,
    message: "Package created successfully!",
    data,
  });
});

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await packageServices.getAll(
    req.user!.role,
    req.query.includeDeleted === "true"
  );
  sendResponse(res, { message: "Packages fetched successfully!", data });
});

const getById = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await packageServices.getById(
    req.params.id as string,
    req.user!.role
  );
  sendResponse(res, { message: "Package fetched successfully!", data });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await packageServices.update(req.params.id as string, req.body);
  sendResponse(res, { message: "Package updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await packageServices.remove(req.params.id as string);
  sendResponse(res, { message: "Package deleted successfully!", data });
});

export const packageController = { create, getAll, getById, update, remove };
