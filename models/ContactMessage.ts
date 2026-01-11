import { Model, DataTypes } from 'sequelize'
import meintoyouapp from '../config/config'

interface ContactMessageInterface {
  id?: number
  name: string
  email: string
  message: string
  createdAt?: Date
  updatedAt?: Date
}

class ContactMessageInt extends Model<ContactMessageInterface> implements ContactMessageInterface {
  id!: number
  name!: string
  email!: string
  message!: string
  createdAt?: Date
  updatedAt?: Date
}

const ContactMessage = meintoyouapp.define<ContactMessageInt>(
  'ContactMessage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: 'contact_messages',
    timestamps: true,
  }
)

export default ContactMessage
