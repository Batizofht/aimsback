import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import Role from "../models/Role";

// Extend Express Request to include user and permissions
declare global {
  namespace Express {
    interface Request {
      user?: any;
      admin?: any;
      permissions?: string[];
    }
  }
}

// Load user permissions from their roles
export const loadUserPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || req.admin?.id;
    if (!userId) {
      return next();
    }

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles",
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!user) {
      return next();
    }

    // Collect all permissions from user's roles
    const permissions: string[] = [];
    const roles = (user as any).roles || [];

    for (const role of roles) {
      permissions.push(...role.permissions);
    }

    // Remove duplicates
    req.permissions = [...new Set(permissions)];
    next();
  } catch (error) {
    console.error("Load permissions error:", error);
    next();
  }
};

// Check if user has required permission
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = req.permissions || [];

    // Super admin with "*" permission can do anything
    if (permissions.includes("*")) {
      return next();
    }

    // Check specific permission
    if (permissions.includes(permission)) {
      return next();
    }

    res.status(403).json({
      message: `Access denied. Required permission: ${permission}`,
      status: 0,
    });
  };
};

// Check if user has any of the required permissions
export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.permissions || [];

    // Super admin with "*" permission can do anything
    if (userPermissions.includes("*")) {
      return next();
    }

    // Check if user has any of the required permissions
    const hasPermission = permissions.some((p) => userPermissions.includes(p));

    if (hasPermission) {
      return next();
    }

    res.status(403).json({
      message: `Access denied. Required one of permissions: ${permissions.join(", ")}`,
      status: 0,
    });
  };
};

// Check if user has all required permissions
export const requireAllPermissions = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.permissions || [];

    // Super admin with "*" permission can do anything
    if (userPermissions.includes("*")) {
      return next();
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every((p) => userPermissions.includes(p));

    if (hasAllPermissions) {
      return next();
    }

    res.status(403).json({
      message: `Access denied. Required all permissions: ${permissions.join(", ")}`,
      status: 0,
    });
  };
};

// Middleware to require admin access
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    res.status(401).json({ message: "Admin access required", status: 0 });
    return;
  }
  next();
};

// Combined middleware: require admin and check permission
export const adminPermission = (permission: string) => {
  return [requireAdmin, loadUserPermissions, requirePermission(permission)];
};
