import { Request, Response } from 'express';
import { Op } from 'sequelize';
import CallLog from '../models/CallLog';
import User from '../models/User';
import { sendPushNotification } from '../utils/pushNotification';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export const startCall = async (req: Request, res: Response) => {
  try {
    const { callerId, calleeId, callId, callType } = req.body;

    const caller_id = Number(callerId);
    const callee_id = Number(calleeId);

    if (!caller_id || !callee_id || !callId || !callType) {
      res.status(400).json({ message: 'callerId, calleeId, callId, callType are required', status: 0 });
      return;
    }
    

    const caller = await User.findByPk(caller_id);
    const callee = await User.findByPk(callee_id);

    if (!caller || !callee) {
      res.status(404).json({ message: 'Caller or callee not found', status: 0 });
      return;
    }

    const log = await CallLog.create({
      caller_id,
      callee_id,
      call_id: String(callId),
      call_type: callType,
      status: 'ringing',
      started_at: new Date(),
    });

    // Attempt to generate Agora tokens for caller and callee (if certificate configured)
    const appId = process.env.AGORA_APP_ID || 'b578cdd65d1043bb8411225ee626ee59';
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || '27a4d0193c9b4c7ab124e36baf83403f';
    let tokenCaller = null;
    let tokenCallee = null;
    if (appCertificate) {
      try {
        // Sanitize channel name to match client's safeRoom calculation
        const sanitizedChannelName = String(callId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        tokenCaller = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          sanitizedChannelName,
          caller_id,
          RtcRole.PUBLISHER,
          privilegeExpiredTs
        );
        tokenCallee = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          sanitizedChannelName,
          callee_id,
          RtcRole.PUBLISHER,
          privilegeExpiredTs
        );
      } catch (e) {
        console.error('Token generation in startCall failed:', e);
      }
    }
    if (callee.push === 'true') {
      await sendPushNotification(Number(callee_id), 'Incoming call', `${caller.f_name || 'Someone'} is calling you`, {
        type: 'incoming_call',
        callId: String(callId),
        callType,
        callerId: caller_id,
      });
    }

    res.status(200).json({
      status: 1,
      callLogId: log.id,
      appId: appId || null,
      tokenCaller,
      tokenCallee,
    });
  } catch (error: any) {
    console.error('startCall error:', error);
    res.status(500).json({ message: 'Server error', status: 0 });
  }
};

export const acceptCall = async (req: Request, res: Response) => {
  try {
    const { callId, userId } = req.body;
    const user_id = Number(userId);

    if (!callId || !user_id) {
      res.status(400).json({ message: 'callId and userId are required', status: 0 });
      return;
    }

    const log = await CallLog.findOne({
      where: {
        call_id: String(callId),
        callee_id: user_id,
        status: 'ringing',
      },
      order: [['createdAt', 'DESC']],
    });

    if (!log) {
      res.status(404).json({ message: 'Call not found', status: 0 });
      return;
    }

    await log.update({ status: 'accepted' });
    // Generate token for accepting user if possible
    const appId = process.env.AGORA_APP_ID || 'b578cdd65d1043bb8411225ee626ee59';
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || '27a4d0193c9b4c7ab124e36baf83403f';
    let token = null;
    if (appCertificate) {
      try {
        // Sanitize channel name to match client's safeRoom calculation
        const sanitizedChannelName = String(callId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          sanitizedChannelName,
          user_id,
          RtcRole.PUBLISHER,
          privilegeExpiredTs
        );
      } catch (e) {
        console.error('Token generation in acceptCall failed:', e);
      }
    }

    res.status(200).json({ status: 1, appId: appId || null, token });
  } catch (error: any) {
    console.error('acceptCall error:', error);
    res.status(500).json({ message: 'Server error', status: 0 });
  }
};

export const endCall = async (req: Request, res: Response) => {
  try {
    const { callId, userId } = req.body;
    const user_id = Number(userId);

    if (!callId || !user_id) {
      res.status(400).json({ message: 'callId and userId are required', status: 0 });
      return;
    }

    const log = await CallLog.findOne({
      where: {
        call_id: String(callId),
        [Op.or]: [{ caller_id: user_id }, { callee_id: user_id }],
        status: { [Op.in]: ['ringing', 'accepted'] },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!log) {
      res.status(404).json({ message: 'Call not found', status: 0 });
      return;
    }

    const nextStatus = log.status === 'ringing' ? 'missed' : 'ended';

    await log.update({
      status: nextStatus,
      ended_at: new Date(),
    });

    res.status(200).json({ status: 1 });
  } catch (error: any) {
    console.error('endCall error:', error);
    res.status(500).json({ message: 'Server error', status: 0 });
  }
};

export const getActiveCallBetweenUsers = async (req: Request, res: Response) => {
  try {
    const { userId, peerId } = req.query;
    const user_id = Number(userId);
    const peer_id = Number(peerId);

    if (!user_id || !peer_id) {
      res.status(400).json({ message: 'userId and peerId are required', status: 0 });
      return;
    }

    const log = await CallLog.findOne({
      where: {
        status: { [Op.in]: ['ringing', 'accepted'] },
        [Op.or]: [
          { caller_id: peer_id, callee_id: user_id },
          { caller_id: user_id, callee_id: peer_id },
        ],
      },
      order: [['createdAt', 'DESC']],
    });

    if (!log) {
      res.status(200).json({ status: 1, call: null });
      return;
    }

    res.status(200).json({
      status: 1,
      call: {
        id: log.id,
        caller_id: log.caller_id,
        callee_id: log.callee_id,
        call_id: log.call_id,
        call_type: log.call_type,
        status: log.status,
        started_at: log.started_at,
        ended_at: log.ended_at,
      },
    });
  } catch (error: any) {
    console.error('getActiveCallBetweenUsers error:', error);
    res.status(500).json({ message: 'Server error', status: 0 });
  }
};

export const getCallHistory = async (req: Request, res: Response) => {
  try {
    const { user } = req.query;
    const user_id = Number(user);

    if (!user_id) {
      res.status(400).json({ message: 'user is required', status: 0 });
      return;
    }

    const logs = await CallLog.findAll({
      where: {
        [Op.or]: [{ caller_id: user_id }, { callee_id: user_id }],
      },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.status(200).json(
      logs.map((l) => ({
        id: l.id,
        caller_id: l.caller_id,
        callee_id: l.callee_id,
        call_id: l.call_id,
        call_type: l.call_type,
        status: l.status,
        started_at: l.started_at,
        ended_at: l.ended_at,
        createdAt: (l as any).createdAt,
      }))
    );
  } catch (error: any) {
    console.error('getCallHistory error:', error);
    res.status(500).json({ message: 'Server error', status: 0 });
  }
};

export const generateAgoraToken = async (req: Request, res: Response) => {
  try {
    const { channelName, userId, callId } = req.body;

    if (!channelName || !userId) {
      res.status(400).json({ message: 'channelName and userId are required', status: 0 });
      return;
    }

    // Agora credentials - Make sure these are stored in environment variables
    const appId = process.env.AGORA_APP_ID || 'b578cdd65d1043bb8411225ee626ee59';
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || '27a4d0193c9b4c7ab124e36baf83403f';

    if (!appCertificate) {
      res.status(500).json({ message: 'Agora certificate not configured', status: 0 });
      return;
    }

    // Sanitize channel name to match client's safeRoom calculation
    const sanitizedChannelName = String(channelName).replace(/[^a-zA-Z0-9_-]/g, '_');
    // Generate token valid for 1 hour
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      sanitizedChannelName,
      Number(userId),
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    res.status(200).json({
      status: 1,
      token: token,
      channelName: channelName,
      userId: userId,
      appId: appId,
      expiresIn: expirationTimeInSeconds,
    });
  } catch (error: any) {
    console.error('generateAgoraToken error:', error);
    res.status(500).json({ message: 'Failed to generate token', status: 0 });
  }
};
