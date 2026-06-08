import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface ContactMessageInterface {
  id?: number
  name: string
  email: string
  subject: string
  body: string
  isRead: boolean
  replied: boolean
  replyMessage?: string
  repliedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

class ContactMessageModel extends Model<ContactMessageInterface> implements ContactMessageInterface {
  id!: number
  name!: string
  email!: string
  subject!: string
  body!: string
  isRead!: boolean
  replied!: boolean
  replyMessage?: string
  repliedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

const ContactMessage = db.define<ContactMessageModel>(
  'ContactMessage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    replied: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    replyMessage: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    repliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
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