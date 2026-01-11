export interface MatchInterface {
  id?: number;
  user_id: number;
  matched_user_id: number;
  status: 'like' | 'pass' | 'super_like';
  createdAt?: Date;
  updatedAt?: Date;
}

