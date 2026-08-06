import { Request, Response } from "express";
import { Op } from "sequelize";
import Event from "../models/Event";

export const list = async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.type) {
      where.type = req.query.type;
    }
    if (req.query.published !== undefined) {
      where.published = req.query.published === "true";
    }
    if (req.query.search) {
      const q = `%${req.query.search}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: q } },
        { excerpt: { [Op.iLike]: q } },
      ];
    }
    const events = await Event.findAll({ where, order: [["createdAt", "DESC"]] });
    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { id, ...eventData } = req.body;
    const dataToSave = {
      ...eventData,
      date: eventData.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };
    const event = await Event.create(dataToSave);
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const event = await Event.findByPk(req.body.id);
    if (!event) return res.status(404).json({ error: "Not found" });
    await event.update(req.body);
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await Event.destroy({ where: { id: req.body.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
