import { Request, Response } from "express";

// TikTok API Configuration
// Requires: TIKTOK_ACCESS_TOKEN in .env
// Get token from: https://developers.tiktok.com/

const TIKTOK_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const TIKTOK_USER_ID = process.env.TIKTOK_USER_ID;

interface TikTokVideo {
  id: string;
  title: string;
  cover_image_url: string;
  share_url: string;
  create_time: string;
  duration: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

interface TikTokMetrics {
  followers: number;
  following: number;
  likes: number;
  videos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  recentVideos: TikTokVideo[];
}

// Check if TikTok API is configured
const isConfigured = () => {
  return !!TIKTOK_TOKEN && !!TIKTOK_USER_ID;
};

// Get TikTok profile metrics
export const getTikTokMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - TikTok API not configured. Set TIKTOK_ACCESS_TOKEN and TIKTOK_USER_ID in .env",
      });
    }

    // Real API call to TikTok API
    const response = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,like_count,video_count&access_token=${TIKTOK_TOKEN}`,
      {
        headers: {
          "Authorization": `Bearer ${TIKTOK_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status}`);
    }

    const profile: any = await response.json();

    // Get recent videos
    const videosResponse = await fetch(
      `https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,duration,view_count,like_count,comment_count,share_count&max_count=10`,
      {
        headers: {
          "Authorization": `Bearer ${TIKTOK_TOKEN}`,
        },
      }
    );

    const videosData: any = await videosResponse.json();

    // Calculate totals
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const videos: TikTokVideo[] = videosData.data?.videos?.map((video: any) => {
      totalViews += video.view_count || 0;
      totalLikes += video.like_count || 0;
      totalComments += video.comment_count || 0;
      totalShares += video.share_count || 0;

      return {
        id: video.id,
        title: video.title || "",
        cover_image_url: video.cover_image_url,
        share_url: video.share_url,
        create_time: video.create_time,
        duration: video.duration,
        view_count: video.view_count || 0,
        like_count: video.like_count || 0,
        comment_count: video.comment_count || 0,
        share_count: video.share_count || 0,
      };
    }) || [];

    const metrics: TikTokMetrics = {
      followers: profile.data?.user?.follower_count || 0,
      following: profile.data?.user?.following_count || 0,
      likes: profile.data?.user?.like_count || 0,
      videos: profile.data?.user?.video_count || 0,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      recentVideos: videos,
    };

    res.status(200).json({
      status: 1,
      metrics,
    });
  } catch (error: any) {
    console.error("TikTok API error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get specific video metrics
export const getTikTokVideoMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - TikTok API not configured",
      });
    }

    const { videoId } = req.params;

    // Get video details
    const videoResponse = await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=id,title,create_time,share_url,video_description,duration,height,width,title,hashtags`,
      {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${TIKTOK_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: {
            video_ids: [videoId],
          },
        }),
      }
    );

    const video = await videoResponse.json();

    res.status(200).json({
      status: 1,
      video: video.data?.videos?.[0],
    });
  } catch (error: any) {
    console.error("TikTok video metrics error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};
