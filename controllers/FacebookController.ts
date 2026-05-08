import { Request, Response } from "express";

// Facebook API Configuration
// Requires: FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID in .env
// Get token from: https://developers.facebook.com/tools/explorer

const FACEBOOK_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;

interface FacebookPost {
  id: string;
  message: string;
  created_time: string;
  permalink_url: string;
  full_picture?: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  impressions?: number;
  reach?: number;
}

interface FacebookMetrics {
  pageName: string;
  followers: number;
  likes: number;
  posts: number;
  totalImpressions: number;
  totalReach: number;
  engagement: number;
  recentPosts: FacebookPost[];
}

// Check if Facebook API is configured
const isConfigured = () => {
  return !!FACEBOOK_TOKEN && !!FACEBOOK_PAGE_ID;
};

// Get Facebook Page metrics
export const getFacebookMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Facebook API not configured. Set FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID in .env",
      });
    }

    // Get page info
    const pageResponse = await fetch(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}?fields=name,fan_count,followers_count,new_like_count&access_token=${FACEBOOK_TOKEN}`
    );

    if (!pageResponse.ok) {
      throw new Error(`Facebook API error: ${pageResponse.status}`);
    }

    const page: any = await pageResponse.json();

    // Get recent posts
    const postsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/posts?fields=id,message,created_time,permalink_url,full_picture,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${FACEBOOK_TOKEN}`
    );

    const postsData: any = await postsResponse.json();

    // Calculate totals and format posts
    let totalImpressions = 0;
    let totalReach = 0;
    let totalEngagement = 0;

    const posts: FacebookPost[] = await Promise.all(
      postsData.data?.map(async (post: any) => {
        const likes = post.likes?.summary?.total_count || 0;
        const comments = post.comments?.summary?.total_count || 0;
        const shares = post.shares?.count || 0;
        const engagement = likes + comments + shares;

        // Get insights for this post if available
        let impressions = 0;
        let reach = 0;
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${post.id}/insights?metric=post_impressions,post_reach&access_token=${FACEBOOK_TOKEN}`
          );
          const insights = await insightsResponse.json();
          impressions = insights.data?.[0]?.values?.[0]?.value || 0;
          reach = insights.data?.[1]?.values?.[0]?.value || 0;
        } catch (e) {
          // Insights may not be available for all posts
        }

        totalImpressions += impressions;
        totalReach += reach;
        totalEngagement += engagement;

        return {
          id: post.id,
          message: post.message || "",
          created_time: post.created_time,
          permalink_url: post.permalink_url,
          full_picture: post.full_picture,
          likes_count: likes,
          comments_count: comments,
          shares_count: shares,
          impressions,
          reach,
        };
      }) || []
    );

    const metrics: FacebookMetrics = {
      pageName: page.name || "",
      followers: page.followers_count || page.fan_count || 0,
      likes: page.fan_count || 0,
      posts: posts.length,
      totalImpressions,
      totalReach,
      engagement: totalEngagement,
      recentPosts: posts,
    };

    res.status(200).json({
      status: 1,
      metrics,
    });
  } catch (error: any) {
    console.error("Facebook API error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get specific post metrics
export const getFacebookPostMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Facebook API not configured",
      });
    }

    const { postId } = req.params;

    // Get post insights
    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=post_impressions,post_reach,post_engaged_users,post_clicks&access_token=${FACEBOOK_TOKEN}`
    );

    const insights = await insightsResponse.json();

    res.status(200).json({
      status: 1,
      insights: insights.data,
    });
  } catch (error: any) {
    console.error("Facebook post metrics error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get page insights (time series data)
export const getFacebookPageInsights = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Facebook API not configured",
      });
    }

    const { days = 30 } = req.query;
    const since = Math.floor(Date.now() / 1000) - (Number(days) * 24 * 60 * 60);

    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/insights?metric=page_impressions,page_engaged_users,page_fan_adds&since=${since}&access_token=${FACEBOOK_TOKEN}`
    );

    const insights = await insightsResponse.json();

    res.status(200).json({
      status: 1,
      insights: insights.data,
    });
  } catch (error: any) {
    console.error("Facebook page insights error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

export default { getFacebookMetrics, getFacebookPostMetrics, getFacebookPageInsights };
