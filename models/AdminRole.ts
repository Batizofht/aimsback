import { DataTypes, Model, Optional } from "sequelize";
import meintoyouapp from "../config/config";

export interface AdminRoleAttributes {
  id: number;
  adminId: number;
  roleId: number;
  assignedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AdminRoleCreationAttributes extends Optional<AdminRoleAttributes, "id"> {}

class AdminRole extends Model<AdminRoleAttributes, AdminRoleCreationAttributes> implements AdminRoleAttributes {
  public id!: number;
  public adminId!: number;
  public roleId!: number;
  public assignedBy?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AdminRole.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "admins",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    assignedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
    },
  },
  {
    sequelize: meintoyouapp,
    modelName: "AdminRole",
    tableName: "admin_roles",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["adminId", "roleId"],
      },
    ],
  }
);

export default AdminRole;
