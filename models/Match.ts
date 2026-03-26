import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";
import { MatchInterface } from "../interfaces/MatchInterface";

class MatchInt extends Model<MatchInterface> implements MatchInterface {
  id!: number;
  user_id!: number;
  matched_user_id!: number;
  status!: 'like' | 'pass' | 'super_like' | 'flag';
}

const Match = meintoyouapp.define<MatchInt>(
  "Match",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    matched_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('like', 'pass', 'super_like', 'flag'),
      allowNull: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "matches",
    timestamps: true,
  }
);

export default Match;

