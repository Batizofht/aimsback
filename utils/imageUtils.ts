import fs from "fs";
import path from "path";

export const saveBase64Image = (base64String: string, folder: string, filename: string): string => {
  try {
    if (!base64String || typeof base64String !== 'string') {
      throw new Error("Invalid base64 string provided");
    }

    // Remove data URL prefix if present (handles various formats)
    let base64Data = base64String.trim();
    base64Data = base64Data.replace(/^data:image\/[^;]+;base64,/, "");
    base64Data = base64Data.replace(/^data:[^;]+;base64,/, "");
    
    // Validate base64 string
    if (!base64Data || base64Data.length === 0) {
      throw new Error("Empty base64 data after removing prefix");
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    
    // Validate buffer was created correctly
    if (!buffer || buffer.length === 0) {
      throw new Error("Failed to create buffer from base64 data");
    }

    console.log(`Decoded base64 to buffer: ${buffer.length} bytes`);
    
    // Determine uploads path - check if running from server directory or project root
    let uploadsBasePath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsBasePath)) {
      // Try with server prefix if running from project root
      uploadsBasePath = path.join(process.cwd(), "server", "uploads");
    }
    
    // Ensure folder exists
    const uploadPath = path.join(uploadsBasePath, folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename}`;
    const filePath = path.join(uploadPath, uniqueFilename);
    
    // Save file as binary (not text)
    fs.writeFileSync(filePath, buffer, { encoding: null });
    
    // Verify file was saved correctly
    const stats = fs.statSync(filePath);
    console.log(`Image saved successfully: ${filePath} (${stats.size} bytes)`);
    
    return uniqueFilename;
  } catch (error: any) {
    console.error("Error saving base64 image:", error.message);
    console.error("Base64 string length:", base64String?.length);
    console.error("Base64 string preview:", base64String?.substring(0, 100));
    throw error;
  }
};

export const deleteImage = (folder: string, filename: string): boolean => {
  try {
    // Determine uploads path - check if running from server directory or project root
    let uploadsBasePath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsBasePath)) {
      // Try with server prefix if running from project root
      uploadsBasePath = path.join(process.cwd(), "server", "uploads");
    }
    
    const filePath = path.join(uploadsBasePath, folder, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Image deleted successfully: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
};

