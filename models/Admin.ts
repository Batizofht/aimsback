import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface AdminInterface {
  id?: number
  email: string
  passwordHash: string
  f_name?: string
  l_name?: string
  role: 'admin' | 'editor' | 'administration' | 'customerCare'
  isActive?: boolean
  lastLoginAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

class AdminModel extends Model<AdminInterface> implements AdminInterface {
  id!: number
  email!: string
  passwordHash!: string
  f_name?: string
  l_name?: string
  role!: 'admin' | 'editor' | 'administration' | 'customerCare'
  isActive?: boolean
  lastLoginAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

const Admin = db.define<AdminModel>(
  'Admin',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(250), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(250), allowNull: false },
    f_name: { type: DataTypes.STRING(100), allowNull: true },
    l_name: { type: DataTypes.STRING(100), allowNull: true },
    role: { type: DataTypes.STRING(30), defaultValue: 'admin' },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'admins',
    timestamps: true,
  }
)

export default Admin