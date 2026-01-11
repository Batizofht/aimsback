export interface MessageInterface {
  id?: number;
  msg_id?: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  date?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

