import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

export interface UserPhotoReviewInterface {
  id?: number;
  userId: number;
  photoRejectReason?: string | null;
  photoSubmittedAt?: Date | null;
  photoReviewedAt?: Date | null;
  rejectionNotifiedAt?: Date | null;
  photoReviewerId?: number | null;
  heldNotifications?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

class UserPhotoReviewInt extends Model<UserPhotoReviewInterface> implements UserPhotoReviewInterface {
  public id!: number;
  public userId!: number;
  public photoRejectReason!: string | null;
  public photoSubmittedAt!: Date | null;
  public photoReviewedAt!: Date | null;
  public rejectionNotifiedAt!: Date | null;
  public photoReviewerId!: number | null;
  public heldNotifications!: any[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const UserPhotoReview = meintoyouapp.define<UserPhotoReviewInt, UserPhotoReviewInterface>(
  "UserPhotoReview",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    photoRejectReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    photoSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    photoReviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionNotifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    photoReviewerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    heldNotifications: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  },
  {
    tableName: "UserPhotoReviews",
    timestamps: true,
  }
);

export default UserPhotoReview;
