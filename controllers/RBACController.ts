import { Request, Response } from "express";
import Role from "../models/Role";
import UserRole from "../models/UserRole";
import User from "../models/User";
import Admin from "../models/Admin";
import AdminRole from "../models/AdminRole";

// Default roles with permissions
const ALL_ADMIN_PAGES = [
  "dashboard",
  "users",
  "user-management",
  "verification",
  "marketing",
  "goals",
  "notifications",
  "reports",
  "contacts",
  "blogs",
];

// Initialize default roles
export const initializeRoles = async () => {
  try {
    for (const pageKey of ALL_ADMIN_PAGES) {
      const name = pageKey
        .split("-")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");

      const [role, created] = await Role.findOrCreate({
        where: { slug: pageKey },
        defaults: {
          name,
          slug: pageKey,
          description: `Full access to ${name} page`,
          permissions: [pageKey],
          isActive: true,
        } as any,
      });

      if (!created) {
        await role.update({
          name,
          description: `Full access to ${name} page`,
          permissions: [pageKey],
          isActive: true,
        });
      }
    }
    console.log("[RBAC] Page roles initialized");
  } catch (error) {
    console.error("[RBAC] Error initializing page roles:", error);
  }
};

// Get all roles
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const roles = await Role.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });
    res.status(200).json({ status: 1, roles });
  } catch (error: any) {
    console.error("Get roles error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Create new role
export const createRole = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, permissions } = req.body;

    if (!name || !slug) {
      res.status(400).json({ message: "Name and slug are required", status: 0 });
      return;
    }

    const existing = await Role.findOne({ where: { slug } });
    if (existing) {
      res.status(400).json({ message: "Role with this slug already exists", status: 0 });
      return;
    }

    const role = await Role.create({
      name,
      slug,
      description,
      permissions: permissions || [],
      isActive: true,
    });

    res.status(201).json({ status: 1, role });
  } catch (error: any) {
    console.error("Create role error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update role
export const updateRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, isActive } = req.body;

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({ message: "Role not found", status: 0 });
      return;
    }

    await role.update({
      name: name || role.name,
      description: description !== undefined ? description : role.description,
      permissions: permissions || role.permissions,
      isActive: isActive !== undefined ? isActive : role.isActive,
    });

    res.status(200).json({ status: 1, role });
  } catch (error: any) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Delete role
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);
    if (!role) {
      res.status(404).json({ message: "Role not found", status: 0 });
      return;
    }

    // Check if role has users or admins
    const userCount = await UserRole.count({ where: { roleId: id } });
    const adminCount = await AdminRole.count({ where: { roleId: id } });
    const totalCount = userCount + adminCount;
    
    if (totalCount > 0) {
      res.status(400).json({
        message: `Cannot delete role. Assigned to ${userCount} users and ${adminCount} admins. Reassign them first.`,
        status: 0,
      });
      return;
    }

    await role.destroy();
    res.status(200).json({ message: "Role deleted", status: 1 });
  } catch (error: any) {
    console.error("Delete role error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Assign role to user
export const assignRoleToUser = async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;
    const assignedBy = (req as any).admin?.id;

    if (!userId || !roleId) {
      res.status(400).json({ message: "userId and roleId are required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      res.status(404).json({ message: "Role not found", status: 0 });
      return;
    }

    const [userRole, created] = await UserRole.findOrCreate({
      where: { userId, roleId },
      defaults: { userId, roleId, assignedBy },
    });

    if (!created) {
      res.status(400).json({ message: "User already has this role", status: 0 });
      return;
    }

    res.status(201).json({ status: 1, userRole });
  } catch (error: any) {
    console.error("Assign role error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Remove role from user
export const removeRoleFromUser = async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;

    const deleted = await UserRole.destroy({
      where: { userId, roleId },
    });

    if (deleted === 0) {
      res.status(404).json({ message: "Role assignment not found", status: 0 });
      return;
    }

    res.status(200).json({ message: "Role removed from user", status: 1 });
  } catch (error: any) {
    console.error("Remove role error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get user roles
export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: ["assignedBy", "createdAt"] },
        },
      ],
    });

    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    res.status(200).json({ status: 1, roles: (user as any).roles });
  } catch (error: any) {
    console.error("Get user roles error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get all users with their roles (for admin)
export const getAllUsersWithRoles = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where[Symbol.for("or")] = [
        { email: { like: `%${search}%` } },
        { f_name: { like: `%${search}%` } },
        { l_name: { like: `%${search}%` } },
      ];
    }

    const users = await User.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      attributes: { exclude: ["password", "OTP", "OTPExpiry"] },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: ["assignedBy", "createdAt"] },
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      status: 1,
      users: users.rows,
      total: users.count,
      page: Number(page),
      totalPages: Math.ceil(users.count / Number(limit)),
    });
  } catch (error: any) {
    console.error("Get users with roles error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// ========== ADMIN MANAGEMENT ==========

// Get all admins with their roles
export const getAllAdminsWithRoles = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where[Symbol.for("or")] = [
        { email: { like: `%${search}%` } },
        { f_name: { like: `%${search}%` } },
        { l_name: { like: `%${search}%` } },
      ];
    }

    const admins = await Admin.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      attributes: { exclude: ["passwordHash"] },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: ["assignedBy", "createdAt"] },
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      status: 1,
      admins: admins.rows,
      total: admins.count,
      page: Number(page),
      totalPages: Math.ceil(admins.count / Number(limit)),
    });
  } catch (error: any) {
    console.error("Get admins with roles error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Assign role to admin
export const assignRoleToAdmin = async (req: Request, res: Response) => {
  try {
    const { adminId, roleId } = req.body;
    const assignedBy = (req as any).admin?.id;

    if (!adminId || !roleId) {
      res.status(400).json({ message: "adminId and roleId are required", status: 0 });
      return;
    }

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      res.status(404).json({ message: "Admin not found", status: 0 });
      return;
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      res.status(404).json({ message: "Role not found", status: 0 });
      return;
    }

    const [adminRole, created] = await AdminRole.findOrCreate({
      where: { adminId, roleId },
      defaults: { adminId, roleId, assignedBy },
    });

    if (!created) {
      res.status(400).json({ message: "Admin already has this role", status: 0 });
      return;
    }

    res.status(201).json({ status: 1, adminRole });
  } catch (error: any) {
    console.error("Assign role to admin error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Remove role from admin
export const removeRoleFromAdmin = async (req: Request, res: Response) => {
  try {
    const { adminId, roleId } = req.body;

    const deleted = await AdminRole.destroy({
      where: { adminId, roleId },
    });

    if (deleted === 0) {
      res.status(404).json({ message: "Role assignment not found", status: 0 });
      return;
    }

    res.status(200).json({ message: "Role removed from admin", status: 1 });
  } catch (error: any) {
    console.error("Remove role from admin error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get admin roles
export const getAdminRoles = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;

    const admin = await Admin.findByPk(adminId, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: ["assignedBy", "createdAt"] },
        },
      ],
    });

    if (!admin) {
      res.status(404).json({ message: "Admin not found", status: 0 });
      return;
    }

    res.status(200).json({ status: 1, roles: (admin as any).roles });
  } catch (error: any) {
    console.error("Get admin roles error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};
