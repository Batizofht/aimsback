import { Request, Response } from "express";
import { Op } from "sequelize";
import BlogPost from "../models/BlogPost";

export const list = async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.type === 'any') {
      // no type filter — admin needs all types
    } else if (req.query.type) {
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
        { content: { [Op.iLike]: q } },
      ];
    }
    const posts = await BlogPost.findAll({ where, order: [["createdAt", "DESC"]] });
    res.json(posts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getLatest = async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.findOne({
      where: { published: { [Op.ne]: false }, type: 'blog' },
      order: [["createdAt", "DESC"]],
    });
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { id, ...postData } = req.body;
    const dataToSave = {
      ...postData,
      date: postData.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };
    const post = await BlogPost.create(dataToSave);
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.findByPk(req.body.id);
    if (!post) return res.status(404).json({ error: "Not found" });
    await post.update(req.body);
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await BlogPost.destroy({ where: { id: req.body.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};