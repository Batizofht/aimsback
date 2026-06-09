import { Request, Response } from "express";
import Appointment from "../models/Appointment";
import { sendAppointmentScheduledEmail, sendAppointmentConfirmedEmail } from "../utils/email";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const items = await Appointment.findAll({ order: [["date", "ASC"]] });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const item = await Appointment.create({ ...req.body });
    if (item.clientEmail && item.clientName) {
      await sendAppointmentScheduledEmail(item.clientEmail, item.clientName, item.title, item.date, item.time, item.platform);
      addSystemMessage(item.clientEmail, "Appointment Scheduled", `A new appointment "${item.title}" has been scheduled for ${item.date} at ${item.time} (${item.platform}).`, item.clientName);
    }
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const item = await Appointment.findByPk(req.body.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    const prevStatus = item.status;
    await item.update(req.body);
    if (req.body.status === "confirmed" && prevStatus !== "confirmed") {
      await sendAppointmentConfirmedEmail(item.clientEmail, item.clientName, item.title, item.date, item.time, item.platform);
      addSystemMessage(item.clientEmail, "Appointment Confirmed", `Your appointment "${item.title}" on ${item.date} at ${item.time} (${item.platform}) has been confirmed.`, item.clientName);
    }
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};