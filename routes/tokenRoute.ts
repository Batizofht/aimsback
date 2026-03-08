import { Router, Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';


const router = Router();

// Agora credentials - hardcoded for production
const AGORA_APP_ID = 'b578cdd65d1043bb8411225ee626ee59';
const AGORA_APP_CERTIFICATE = '27a4d0193c9b4c7ab124e36baf83403f';

/**
 * Generate Agora RTC token
 * POST /token
 * Body: { channelName: string, uid: number, role: 'publisher' | 'subscriber' }
 */
router.post('/token', (req: Request, res: Response) => {
  try {
    const { channelName, uid, role } = req.body;

    console.log('[Token API] Request received:', { channelName, uid, role });

    if (!channelName || uid === undefined) {
      console.error('[Token API] Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'channelName and uid are required',
      });
    }

    if (!AGORA_APP_CERTIFICATE) {
      console.error('[Token API] AGORA_APP_CERTIFICATE not set in environment');
      return res.status(500).json({
        success: false,
        message: 'Token generation not configured on server',
      });
    }

    if (!AGORA_APP_ID) {
      console.error('[Token API] AGORA_APP_ID not configured');
      return res.status(500).json({
        success: false,
        message: 'Agora App ID not configured',
      });
    }

    // Token expiration: 1 hour (3600 seconds)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Determine role
    const agoraRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs
    );

    console.log(`[Token] Generated token for channel: ${channelName}, uid: ${uid}`);

    return res.json({
      success: true,
      token: token,
      channelName: channelName,
    });
  } catch (error) {
    console.error('[Token] Error generating token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
