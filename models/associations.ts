import User from "./User";
import Match from "./Match";
import Message from "./Message";
import Notification from "./Notification";
import PushToken from "./PushToken";
import CallLog from "./CallLog";

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

};

