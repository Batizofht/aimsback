import { Model, DataTypes } from 'sequelize'
import meintoyouapp from '../config/config'

interface AdminInterface {
  id?: number
  email: string
  passwordHash: string
  f_name?: string
  l_name?: string
  isSuperAdmin?: boolean
  isActive?: boolean
  lastLoginAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

class AdminInt extends Model<AdminInterface> implements AdminInterface {
  id!: number
  email!: string
  passwordHash!: string
  f_name?: string
  l_name?: string
  isSuperAdmin?: boolean
  isActive?: boolean
  lastLoginAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

const Admin = meintoyouapp.define<AdminInt>(
  'Admin',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(250),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    f_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    l_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isSuperAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: 'admins',
    timestamps: true,
  }
)

export default Admin
