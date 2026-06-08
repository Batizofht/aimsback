import { Model, DataTypes } from 'sequelize'
import db from '../config/config'

interface ServiceRequestInterface {
  id: string
  clientName: string
  clientEmail: string
  category: string
  service: string
  status: 'pending' | 'approved' | 'rejected'
  priority: 'normal' | 'urgent'
  date: string
  notes: string
}

class ServiceRequestModel extends Model<ServiceRequestInterface> implements ServiceRequestInterface {
  id!: string
  clientName!: string
  clientEmail!: string
  category!: string
  service!: string
  status!: 'pending' | 'approved' | 'rejected'
  priority!: 'normal' | 'urgent'
  date!: string
  notes!: string
}

const ServiceRequest = db.define<ServiceRequestModel>(
  'ServiceRequest',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientName: { type: DataTypes.STRING(150), allowNull: false },
    clientEmail: { type: DataTypes.STRING(250), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: false },
    service: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    priority: { type: DataTypes.ENUM('normal', 'urgent'), defaultValue: 'normal' },
    date: { type: DataTypes.STRING(20), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'service_requests',
    timestamps: true,
  }
)

export default ServiceRequest