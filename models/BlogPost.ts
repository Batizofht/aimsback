import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface BlogPostInterface {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  date: string
  author: string
  readTime: string
  image: string | null
  published: boolean
}

class BlogPostModel extends Model<BlogPostInterface> implements BlogPostInterface {
  id!: string
  slug!: string
  title!: string
  excerpt!: string
  content!: string
  category!: string
  date!: string
  author!: string
  readTime!: string
  image!: string | null
  published!: boolean
}

const BlogPost = db.define<BlogPostModel>(
  'BlogPost',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    slug: { type: DataTypes.STRING(255), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    excerpt: { type: DataTypes.TEXT, allowNull: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    category: { type: DataTypes.STRING(100), defaultValue: 'Uncategorized' },
    date: { type: DataTypes.STRING(50), allowNull: true },
    author: { type: DataTypes.STRING(150), allowNull: true },
    readTime: { type: DataTypes.STRING(50), defaultValue: '3 min read' },
    image: { type: DataTypes.STRING(500), allowNull: true },
    published: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'blog_posts',
    timestamps: true,
  }
)

export default BlogPost