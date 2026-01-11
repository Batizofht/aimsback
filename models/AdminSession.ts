import { Model, DataTypes } from 'sequelize'
import meintoyouapp from '../config/config'

interface AdminSessionInterface {
  id?: number
  adminId: number
  token: string
  expiresAt: Date
  createdAt?: Date
  updatedAt?: Date
}

class AdminSessionInt extends Model<AdminSessionInterface> implements AdminSessionInterface {
  id!: number
  adminId!: number
  token!: string
  expiresAt!: Date
  createdAt?: Date
  updatedAt?: Date
}

const AdminSession = meintoyouapp.define<AdminSessionInt>(
  'AdminSession',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    token: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: 'admin_sessions',
    timestamps: true,
    indexes: [{ fields: ['token'] }, { fields: ['adminId'] }],
  }
)

export default AdminSession
