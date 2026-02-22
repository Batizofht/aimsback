import { DataTypes, Model } from 'sequelize'
import meintoyouapp from '../config/config'

export type BlogStatus = 'draft' | 'public'

interface BlogInterface {
  id?: number
  title: string
  slug: string
  excerpt?: string | null
  content: string
  coverImage?: string | null
  status: BlogStatus
  viewCount?: number
  publishedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

class BlogInt extends Model<BlogInterface> implements BlogInterface {
  id!: number
  title!: string
  slug!: string
  excerpt?: string | null
  content!: string
  coverImage?: string | null
  status!: BlogStatus
  viewCount?: number
  publishedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const Blog = meintoyouapp.define<BlogInt>(
  'Blog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(280),
      allowNull: false,
      unique: true,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    coverImage: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'public']],
      },
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'blogs',
    timestamps: true,
  }
)

export default Blog
