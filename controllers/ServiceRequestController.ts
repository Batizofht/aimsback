import { Request, Response } from "express";
import ServiceRequest from "../models/ServiceRequest";
import { sendServiceRequestUpdateEmail } from "../utils/email";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.email) where.clientEmail = req.query.email;
    const items = await ServiceRequest.findAll({ where, order: [["createdAt", "DESC"]] });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const item = await ServiceRequest.create({ ...req.body });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const item = await ServiceRequest.findByPk(req.body.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    const prevStatus = item.status;
    await item.update(req.body);
    if (req.body.status && req.body.status !== prevStatus) {
      await sendServiceRequestUpdateEmail(item.clientEmail, item.clientName, item.service, req.body.status);
      const label = req.body.status === "approved" ? "Approved" : "Rejected";
      addSystemMessage(item.clientEmail, `Service Request ${label}`, `Your service request for "${item.service}" has been ${label}.`, item.clientName);
    }
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};