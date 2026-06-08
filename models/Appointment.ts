import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface AppointmentInterface {
  id: number
  title: string
  date: string
  time: string
  platform: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  priority: 'normal' | 'urgent'
  notes: string
  clientName: string
  clientEmail: string
}

class AppointmentModel extends Model<AppointmentInterface> implements AppointmentInterface {
  id!: number
  title!: string
  date!: string
  time!: string
  platform!: string
  status!: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  priority!: 'normal' | 'urgent'
  notes!: string
  clientName!: string
  clientEmail!: string
}

const Appointment = db.define<AppointmentModel>(
  'Appointment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    date: { type: DataTypes.STRING(20), allowNull: false },
    time: { type: DataTypes.STRING(10), allowNull: false },
    platform: { type: DataTypes.STRING(50), defaultValue: 'Zoom' },
    status: { type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'), defaultValue: 'pending' },
    priority: { type: DataTypes.ENUM('normal', 'urgent'), defaultValue: 'normal' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    clientName: { type: DataTypes.STRING(150), allowNull: false },
    clientEmail: { type: DataTypes.STRING(250), allowNull: false },
  },
  {
    tableName: 'appointments',
    timestamps: true,
  }
)

export default Appointment