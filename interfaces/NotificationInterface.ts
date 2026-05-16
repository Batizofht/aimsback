export interface NotificationInterface {
  id?: number;
  user_id: number;
  sender_id: number | null;
  message: string;
  is_read: boolean;
  title: string;
  datesent?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  sender?: {
    id?: number;
    f_name?: string;
    l_name?: string;
    profile?: string;
    verificationStatus?: "unverified" | "pending" | "verified" | "rejected";
    
  };
}
