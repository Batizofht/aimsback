import { DataTypes, Model, Optional } from "sequelize";
import meintoyouapp from "../config/config";

export interface UserRoleAttributes {
  id: number;
  userId: number;
  roleId: number;
  assignedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserRoleCreationAttributes extends Optional<UserRoleAttributes, "id"> {}

class UserRole extends Model<UserRoleAttributes, UserRoleCreationAttributes> implements UserRoleAttributes {
  public id!: number;
  public userId!: number;
  public roleId!: number;
  public assignedBy?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserRole.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
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
        model: "users",
        key: "id",
      },
    },
  },
  {
    sequelize: meintoyouapp,
    modelName: "UserRole",
    tableName: "user_roles",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "roleId"],
      },
    ],
  }
);

export default UserRole;
