import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

class NotificationCampaignInt extends Model {
  public id!: number;
  public title!: string;
  public message!: string;
  public type!: "push" | "email" | "both";
  public status!: "draft" | "scheduled" | "sending" | "sent" | "failed";
  public recipientType!: "all" | "verified" | "premium" | "free" | "specific";
  public recipientCount!: number;
  public scheduledAt!: Date | null;
  public sentAt!: Date | null;
  public createdBy!: string;
  public createdById!: number | null;
  public sentCount!: number;
  public failedCount!: number;
  public specificUserIds!: number[];
}

const NotificationCampaign = meintoyouapp.define<NotificationCampaignInt>(
  "NotificationCampaign",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("push", "email", "both"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("draft", "scheduled", "sending", "sent", "failed"),
      allowNull: false,
      defaultValue: "draft",
    },
    recipientType: {
      type: DataTypes.ENUM("all", "verified", "premium", "free", "specific"),
      allowNull: false,
      defaultValue: "all",
    },
    recipientCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "admin",
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    specificUserIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "notification_campaigns",
    timestamps: true,
  }
);

export default NotificationCampaign;
