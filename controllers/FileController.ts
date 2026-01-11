import { Request, Response } from "express";
import path from "path";
import fs from "fs";

// Retrieve File
export const retrieveFile = async (req: Request, res: Response) => {
  try {
    const { file } = req.params;
    const { folder } = req.query;

    if (!file) {
      res.status(400).json({ message: "File name is required", status: 0 });
      return;
    }

    const folderPath = (typeof folder === 'string' ? folder : "Images");
    // Use process.cwd() - if running from server directory, it's already there
    // If running from project root, we'd need "server/uploads", but check both
    let uploadsBasePath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsBasePath)) {
      // Try with server prefix if running from project root
      uploadsBasePath = path.join(process.cwd(), "server", "uploads");
    }
    const filePath = path.join(uploadsBasePath, folderPath, file);

    // Normalize the path to handle any path traversal issues
    const normalizedPath = path.normalize(filePath);
    
    // Security check: ensure the resolved path is within the uploads directory
    if (!normalizedPath.startsWith(path.normalize(uploadsBasePath))) {
      res.status(403).json({ message: "Access denied", status: 0 });
      return;
    }

    if (!fs.existsSync(normalizedPath)) {
      console.error(`File not found: ${normalizedPath}`);
      res.status(404).json({ message: "File not found", status: 0 });
      return;
    }

    res.sendFile(normalizedPath);
  } catch (error: any) {
    console.error("Retrieve file error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

