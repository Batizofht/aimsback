export interface CallLogInterface {
  id?: number;
  caller_id: number;
  callee_id: number;
  call_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'ended' | 'missed' | 'rejected';
  started_at?: Date;
  ended_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
