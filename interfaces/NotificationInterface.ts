export interface NotificationInterface {
  id?: number;
  user_id: number;
  sender_id: number;
  message: string;
  is_read:boolean;
  title: string;
  datesent?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

