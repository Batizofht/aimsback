import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

interface PushTokenInterface {
  id?: number;
  user_id: number;
  token: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class PushTokenInt extends Model<PushTokenInterface> implements PushTokenInterface {
  id!: number;
  user_id!: number;
  token!: string;
}

const PushToken = meintoyouapp.define<PushTokenInt>(
  "PushToken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "push_tokens",
    timestamps: true,
  }
);

export default PushToken;

