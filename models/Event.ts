import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface EventInterface {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  type: string
  mediaUrl: string | null
  coverImage: string | null
  published: boolean
}

class EventModel extends Model<EventInterface> implements EventInterface {
  id!: string
  slug!: string
  title!: string
  excerpt!: string
  category!: string
  date!: string
  type!: string
  mediaUrl!: string | null
  coverImage!: string | null
  published!: boolean
}

const Event = db.define<EventModel>(
  'Event',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    slug: { type: DataTypes.STRING(255), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    excerpt: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(100), defaultValue: 'Uncategorized' },
    date: { type: DataTypes.STRING(50), allowNull: true },
    type: { type: DataTypes.STRING(20), defaultValue: 'video' },
    mediaUrl: { type: DataTypes.STRING(500), allowNull: true },
    coverImage: { type: DataTypes.STRING(500), allowNull: true },
    published: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'events',
    timestamps: true,
  }
)

export default Event
