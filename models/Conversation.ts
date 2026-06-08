import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface ConversationInterface {
  id?: number
  with: string
  email: string
  customerEmail: string
  lastMessage: string
  date: string
  unread: boolean
}

class ConversationModel extends Model<ConversationInterface> implements ConversationInterface {
  id!: number
  with!: string
  email!: string
  customerEmail!: string
  lastMessage!: string
  date!: string
  unread!: boolean
}

const Conversation = db.define<ConversationModel>(
  'Conversation',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    with: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(250), allowNull: false },
    customerEmail: { type: DataTypes.STRING(250), allowNull: false, unique: true },
    lastMessage: { type: DataTypes.TEXT, allowNull: true },
    date: { type: DataTypes.STRING(20), allowNull: true },
    unread: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: 'conversations',
    timestamps: true,
  }
)

export default Conversation