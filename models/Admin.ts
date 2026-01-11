import { Model, DataTypes } from 'sequelize'
import meintoyouapp from '../config/config'

interface AdminInterface {
  id?: number
  email: string
  passwordHash: string
  createdAt?: Date
  updatedAt?: Date
}

class AdminInt extends Model<AdminInterface> implements AdminInterface {
  id!: number
  email!: string
  passwordHash!: string
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
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: 'admins',
    timestamps: true,
  }
)

export default Admin
