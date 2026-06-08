import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface TeamMemberInterface {
  id?: number
  name: string
  title: string
  bio?: string
  photo?: string
  email?: string
  phone?: string
  orderIndex: number
  isActive: boolean
  socialLinks?: string
  createdAt?: Date
  updatedAt?: Date
}

class TeamMemberModel extends Model<TeamMemberInterface> implements TeamMemberInterface {
  id!: number
  name!: string
  title!: string
  bio?: string
  photo?: string
  email?: string
  phone?: string
  orderIndex!: number
  isActive!: boolean
  socialLinks?: string
  createdAt?: Date
  updatedAt?: Date
}

const TeamMember = db.define<TeamMemberModel>(
  'TeamMember',
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
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    socialLinks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: 'team_members',
    timestamps: true,
  }
)

export default TeamMember