import User from "./User";
import Match from "./Match";
import Message from "./Message";
import Notification from "./Notification";
import PushToken from "./PushToken";
import CallLog from "./CallLog";
import UserPhotoReview from "./UserPhotoReview";
import AIPromptMatching from "./AIPromptMatching";
import Role from "./Role";
import UserRole from "./UserRole";
import Admin from "./Admin";
import AdminRole from "./AdminRole";

export const defineAssociations = () => {
  // User associations
  User.hasMany(Match, { foreignKey: 'user_id', as: 'matches' });
  User.hasMany(Match, { foreignKey: 'matched_user_id', as: 'matchedBy' });
  User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });
  User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages' });
  User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
  User.hasMany(PushToken, { foreignKey: 'user_id', as: 'pushTokens' });
  User.hasMany(CallLog, { foreignKey: 'caller_id', as: 'outgoingCalls' });
  User.hasMany(CallLog, { foreignKey: 'callee_id', as: 'incomingCalls' });
  User.hasOne(UserPhotoReview, { foreignKey: 'userId', as: 'photoReview' });
  User.hasOne(AIPromptMatching, { foreignKey: 'user_id', as: 'aiPrompt' });

  // User Role associations (for regular app users)
  User.belongsToMany(Role, { through: UserRole, foreignKey: "userId", as: "roles" });
  Role.belongsToMany(User, { through: UserRole, foreignKey: "roleId", as: "users" });

  UserRole.belongsTo(User, { foreignKey: "userId", as: "user" });
  UserRole.belongsTo(Role, { foreignKey: "roleId", as: "role" });
  UserRole.belongsTo(User, { foreignKey: "assignedBy", as: "assigner" });

  // Admin associations
  Admin.belongsToMany(Role, { through: AdminRole, foreignKey: "adminId", as: "roles" });
  Role.belongsToMany(Admin, { through: AdminRole, foreignKey: "roleId", as: "admins" });

  AdminRole.belongsTo(Admin, { foreignKey: "adminId", as: "admin" });
  AdminRole.belongsTo(Role, { foreignKey: "roleId", as: "role" });
  AdminRole.belongsTo(Admin, { foreignKey: "assignedBy", as: "assigner" });

  // Match associations
  Match.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Match.belongsTo(User, { foreignKey: 'matched_user_id', as: 'matchedUser' });

  // Message associations
  Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
  Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });
  
  // Notification associations
  Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
  
  // PushToken associations
  PushToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // CallLog associations
  CallLog.belongsTo(User, { foreignKey: 'caller_id', as: 'caller' });
  CallLog.belongsTo(User, { foreignKey: 'callee_id', as: 'callee' });

  // UserPhotoReview associations
  UserPhotoReview.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // AIPromptMatching associations
  AIPromptMatching.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

};

