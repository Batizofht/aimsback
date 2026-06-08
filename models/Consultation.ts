import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface ConsultationInterface {
  id: number
  name: string
  email: string
  phone: string
  platform: string
  date: string
  time: string
  notes: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  adminReply: string | null
}

class ConsultationModel extends Model<ConsultationInterface> implements ConsultationInterface {
  id!: number
  name!: string
  email!: string
  phone!: string
  platform!: string
  date!: string
  time!: string
  notes!: string
  status!: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  adminReply!: string | null
}

const Consultation = db.define<ConsultationModel>(
  'Consultation',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(250), allowNull: false },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    platform: { type: DataTypes.STRING(50), allowNull: false },
    date: { type: DataTypes.STRING(20), allowNull: false },
    time: { type: DataTypes.STRING(10), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'), defaultValue: 'pending' },
    adminReply: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'consultations',
    timestamps: true,
  }
)

export default Consultation