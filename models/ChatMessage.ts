import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface ChatMessageInterface {
  id?: number
  conversationId: number
  from: string
  text: string
  time: string
}

class ChatMessageModel extends Model<ChatMessageInterface> implements ChatMessageInterface {
  id!: number
  conversationId!: number
  from!: string
  text!: string
  time!: string
}

const ChatMessage = db.define<ChatMessageModel>(
  'ChatMessage',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: false },
    from: { type: DataTypes.STRING(150), allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    time: { type: DataTypes.STRING(20), allowNull: false },
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    indexes: [{ fields: ['conversationId'] }],
  }
)

export default ChatMessage