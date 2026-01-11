import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

interface ReportInterface {
  id?: number;
  reporter_id: number;
  reported_user_id: number;
  report_type: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ReportInt extends Model<ReportInterface> implements ReportInterface {
  id!: number;
  reporter_id!: number;
  reported_user_id!: number;
  report_type!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const Report = meintoyouapp.define<ReportInt>(
  "Report",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reporter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reported_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    report_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "reports",
    timestamps: true,
  }
);

export default Report;
