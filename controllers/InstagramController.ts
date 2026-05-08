import { Request, Response } from "express";

// Instagram API Configuration
// Requires: INSTAGRAM_ACCESS_TOKEN in .env
// Get token from: https://developers.facebook.com/docs/instagram-basic-display-api

const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

interface InstagramPost {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  username: string;
  like_count: number;
  comments_count: number;
  video_views?: number;
}

interface InstagramMetrics {
  followers: number;
  following: number;
  posts: number;
  totalLikes: number;
  totalComments: number;
  totalVideoViews: number;
  recentPosts: InstagramPost[];
}

// Check if Instagram API is configured
const isConfigured = () => {
  return !!INSTAGRAM_TOKEN && !!INSTAGRAM_USER_ID;
};

// Get Instagram profile metrics
export const getInstagramMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Instagram API not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID in .env",
      });
    }

    // Real API call to Instagram Graph API
    const response = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_USER_ID}?fields=account_type,media_count,followers_count,follows_count&access_token=${INSTAGRAM_TOKEN}`
    );

    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.status}`);
    }

    const profile: any = await response.json();

    // Get recent media with insights
    const mediaResponse = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count&limit=10&access_token=${INSTAGRAM_TOKEN}`
    );

    const media: any = await mediaResponse.json();

    // Calculate totals
    let totalLikes = 0;
    let totalComments = 0;
    let totalVideoViews = 0;

    const posts: InstagramPost[] = await Promise.all(
      media.data?.map(async (post: any) => {
        totalLikes += post.like_count || 0;
        totalComments += post.comments_count || 0;

        // Get video views if it's a video
        let videoViews = 0;
        if (post.media_type === "VIDEO") {
          try {
            const insightsResponse = await fetch(
              `https://graph.instagram.com/${post.id}/insights?metric=video_views&access_token=${INSTAGRAM_TOKEN}`
            );
            const insights = await insightsResponse.json();
            videoViews = insights.data?.[0]?.values?.[0]?.value || 0;
            totalVideoViews += videoViews;
          } catch (e) {
            // Ignore insights errors
          }
        }

        return {
          id: post.id,
          caption: post.caption || "",
          media_type: post.media_type,
          media_url: post.media_url,
          permalink: post.permalink,
          thumbnail_url: post.thumbnail_url,
          timestamp: post.timestamp,
          username: post.username,
          like_count: post.like_count || 0,
          comments_count: post.comments_count || 0,
          video_views: videoViews,
        };
      }) || []
    );

    const metrics: InstagramMetrics = {
      followers: profile.followers_count || 0,
      following: profile.follows_count || 0,
      posts: profile.media_count || 0,
      totalLikes,
      totalComments,
      totalVideoViews,
      recentPosts: posts,
    };

    res.status(200).json({
      status: 1,
      metrics,
    });
  } catch (error: any) {
    console.error("Instagram API error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get specific post metrics (for video views)
export const getInstagramPostMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Instagram API not configured",
      });
    }

    const { postId } = req.params;

    // Get post insights
    const insightsResponse = await fetch(
      `https://graph.instagram.com/${postId}/insights?metric=engagement,impressions,reach,saved,video_views&access_token=${INSTAGRAM_TOKEN}`
    );

    const insights = await insightsResponse.json();

    res.status(200).json({
      status: 1,
      insights: insights.data,
    });
  } catch (error: any) {
    console.error("Instagram post metrics error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};
