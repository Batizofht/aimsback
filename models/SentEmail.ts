import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

class SentEmail extends Model {
  public id!: number;
  public campaignId!: number;
  public userId!: number;
  public email!: string;
  public subject!: string;
  public message!: string | null;
  public sentAt!: Date;
  public status!: 'sent' | 'failed';
}

const SentEmailModel = meintoyouapp.define<SentEmail>(
  "SentEmail",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM('sent', 'failed'),
      allowNull: false,
      defaultValue: 'sent',
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "sent_emails",
    timestamps: true,
  },
);

export default SentEmailModel;
