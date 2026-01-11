import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";
import { NotificationInterface } from "../interfaces/NotificationInterface";

class NotificationInt extends Model<NotificationInterface> implements NotificationInterface {
  id!: number;
  user_id!: number;
  sender_id!: number;
  is_read!:boolean;
  message!: string;
  title!: string;
  datesent?: Date;
}

const Notification = meintoyouapp.define<NotificationInt>(
  "Notification",
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
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    datesent: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "notifications",
    timestamps: true,
  }
);

export default Notification;

