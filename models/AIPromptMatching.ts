import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";

interface AIPromptMatchingInterface {
  id?: number;
  user_id: number;
  prompt: string;
  isEnabled: boolean;
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

class AIPromptMatchingInt extends Model<AIPromptMatchingInterface> implements AIPromptMatchingInterface {
  id!: number;
  user_id!: number;
  prompt!: string;
  isEnabled!: boolean;
  lastUpdated!: Date;
}

const AIPromptMatching = meintoyouapp.define<AIPromptMatchingInt, AIPromptMatchingInterface>(
  "AIPromptMatching",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 15000], // Max 1500 words roughly
      },
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "ai_prompt_matching",
    timestamps: true,
    indexes: [
      {
        fields: ["user_id"],
        unique: true,
      },
      {
        fields: ["isEnabled"],
      },
    ],
  }
);

export default AIPromptMatching;
