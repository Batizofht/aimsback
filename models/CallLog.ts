import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";
import { CallLogInterface } from "../interfaces/CallLogInterface";

class CallLogInt extends Model<CallLogInterface> implements CallLogInterface {
  id!: number;
  caller_id!: number;
  callee_id!: number;
  call_id!: string;
  call_type!: 'audio' | 'video';
  status!: 'ringing' | 'accepted' | 'ended' | 'missed' | 'rejected';
  started_at?: Date;
  ended_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const CallLog = meintoyouapp.define<CallLogInt>(
  "CallLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    caller_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    callee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    call_id: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    call_type: {
      type: DataTypes.ENUM('audio', 'video'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('ringing', 'accepted', 'ended', 'missed', 'rejected'),
      allowNull: false,
      defaultValue: 'ringing',
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "call_logs",
    timestamps: true,
  }
);

export default CallLog;
