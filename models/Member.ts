import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface MemberInterface {
  id: string
  name: string
  email: string
  passwordHash: string
  phone: string | null
  membershipType: 'beneficial' | 'professional'
  joined: string
  status: 'pending' | 'active' | 'suspended'
  rejectionReason: string | null
}

class MemberModel extends Model<MemberInterface> implements MemberInterface {
  id!: string
  name!: string
  email!: string
  passwordHash!: string
  phone!: string | null
  membershipType!: 'beneficial' | 'professional'
  joined!: string
  status!: 'pending' | 'active' | 'suspended'
  rejectionReason!: string | null
}

const Member = db.define<MemberModel>(
  'Member',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(250), allowNull: false },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    membershipType: { type: DataTypes.ENUM('beneficial', 'professional'), allowNull: false },
    joined: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'active', 'suspended'), defaultValue: 'pending' },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'members',
    timestamps: true,
  }
)

export default Member