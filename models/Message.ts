import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";
import { MessageInterface } from "../interfaces/MessageInterface";

class MessageInt extends Model<MessageInterface> implements MessageInterface {
  id!: number;
  msg_id?: number;
  sender_id!: number;
  receiver_id!: number;
  message!: string;
  date?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const Message = meintoyouapp.define<MessageInt>(
  "Message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    msg_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    receiver_id: {
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
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "messages",
    timestamps: true,
  }
);

export default Message;

