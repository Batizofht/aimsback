import { Request, Response } from "express";

// Reddit API Configuration
// Requires: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_ACCESS_TOKEN in .env
// Register app at: https://www.reddit.com/prefs/apps

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_ACCESS_TOKEN = process.env.REDDIT_ACCESS_TOKEN;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME; // e.g., u/meintoyou

interface RedditPost {
  id: string;
  title: string;
  url: string;
  permalink: string;
  author: string;
  created_utc: number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  thumbnail: string;
  subreddit: string;
}

interface RedditMetrics {
  karma: number;
  linkKarma: number;
  commentKarma: number;
  followers: number;
  totalPosts: number;
  totalScore: number;
  totalComments: number;
  avgUpvoteRatio: number;
  recentPosts: RedditPost[];
}

// Check if Reddit API is configured
const isConfigured = () => {
  return !!REDDIT_CLIENT_ID && !!REDDIT_CLIENT_SECRET && !!REDDIT_ACCESS_TOKEN;
};

// Get Reddit profile metrics
export const getRedditMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Reddit API not configured. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_ACCESS_TOKEN in .env",
      });
    }

    // Get user profile
    const profileResponse = await fetch(
      `https://oauth.reddit.com/api/v1/me`,
      {
        headers: {
          "Authorization": `Bearer ${REDDIT_ACCESS_TOKEN}`,
          "User-Agent": "MeIntoYou-App/1.0",
        },
      }
    );

    if (!profileResponse.ok) {
      throw new Error(`Reddit API error: ${profileResponse.status}`);
    }

    const profile: any = await profileResponse.json();

    // Get user's submissions
    const submissionsResponse = await fetch(
      `https://oauth.reddit.com/user/${REDDIT_USERNAME}/submitted?limit=10`,
      {
        headers: {
          "Authorization": `Bearer ${REDDIT_ACCESS_TOKEN}`,
          "User-Agent": "MeIntoYou-App/1.0",
        },
      }
    );

    const submissions: any = await submissionsResponse.json();

    // Calculate totals
    let totalScore = 0;
    let totalComments = 0;
    let totalUpvoteRatio = 0;

    const posts: RedditPost[] = submissions.data?.children?.map((child: any) => {
      const post = child.data;
      totalScore += post.score || 0;
      totalComments += post.num_comments || 0;
      totalUpvoteRatio += post.upvote_ratio || 0;

      return {
        id: post.id,
        title: post.title,
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`,
        author: post.author,
        created_utc: post.created_utc,
        score: post.score || 0,
        upvote_ratio: post.upvote_ratio || 0,
        num_comments: post.num_comments || 0,
        thumbnail: post.thumbnail,
        subreddit: post.subreddit,
      };
    }) || [];

    const postCount = posts.length;
    const avgUpvoteRatio = postCount > 0 ? totalUpvoteRatio / postCount : 0;

    const metrics: RedditMetrics = {
      karma: profile.total_karma || 0,
      linkKarma: profile.link_karma || 0,
      commentKarma: profile.comment_karma || 0,
      followers: profile.subreddit?.subscribers || 0,
      totalPosts: postCount,
      totalScore,
      totalComments,
      avgUpvoteRatio,
      recentPosts: posts,
    };

    res.status(200).json({
      status: 1,
      metrics,
    });
  } catch (error: any) {
    console.error("Reddit API error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get specific post metrics
export const getRedditPostMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Reddit API not configured",
      });
    }

    const { postId } = req.params;

    // Get post details
    const postResponse = await fetch(
      `https://oauth.reddit.com/api/info/?id=t3_${postId}`,
      {
        headers: {
          "Authorization": `Bearer ${REDDIT_ACCESS_TOKEN}`,
          "User-Agent": "MeIntoYou-App/1.0",
        },
      }
    );

    const post = await postResponse.json();

    res.status(200).json({
      status: 1,
      post: post.data?.children?.[0]?.data,
    });
  } catch (error: any) {
    console.error("Reddit post metrics error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};

// Get subreddit metrics (for tracking community growth)
export const getSubredditMetrics = async (req: Request, res: Response) => {
  try {
    if (!isConfigured()) {
      return res.status(200).json({
        status: 0,
        message: "No data available - Reddit API not configured",
      });
    }

    const { subreddit } = req.params;

    // Get subreddit details
    const subredditResponse = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/about`,
      {
        headers: {
          "Authorization": `Bearer ${REDDIT_ACCESS_TOKEN}`,
          "User-Agent": "MeIntoYou-App/1.0",
        },
      }
    );

    const subredditData = await subredditResponse.json();

    res.status(200).json({
      status: 1,
      subreddit: subredditData.data,
    });
  } catch (error: any) {
    console.error("Reddit subreddit metrics error:", error);
    res.status(200).json({
      status: 0,
      message: "No data available",
      error: error.message,
    });
  }
};
