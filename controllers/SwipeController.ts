import { Request, Response } from "express";
import User from "../models/User";
import Match from "../models/Match";
import { calculateDistance } from "../utils/distance";
import { Op } from "sequelize";
import { sendPushNotification } from "../utils/pushNotification";
import Notification from "../models/Notification";
const toNumberOrUndefined = (value: any): number | undefined => {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toTrimmedLower = (value: any): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const parseInterestList = (value: any): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((i) => i.trim().toLowerCase())
    .filter(Boolean);
};

const computeInterestOverlapCount = (a: any, b: any): number => {
  const aList = parseInterestList(a);
  const bList = parseInterestList(b);
  if (!aList.length || !bList.length) return 0;
  const bSet = new Set(bList);
  let count = 0;
  for (const item of aList) {
    if (bSet.has(item)) count += 1;
  }
  return count;
};

const computeCandidateDistanceKm = (currentUser: any, candidate: any): number => {
  const lat1 = toNumberOrUndefined(currentUser.lats);
  const lon1 = toNumberOrUndefined(currentUser.longs);
  const lat2 = toNumberOrUndefined(candidate.lats);
  const lon2 = toNumberOrUndefined(candidate.longs);

  if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }

  return Infinity;
};

// Calculate user's age from birth year
const calculateAge = (years: any): number | undefined => {
  const yearValue = toNumberOrUndefined(years);
  if (yearValue == null) return undefined;
  
  const currentYear = new Date().getFullYear();
  
  // If years is already an age (< 120), return it
  if (yearValue < 120) return yearValue;
  
  // If years is a birth year (> 1900), calculate age
  if (yearValue > 1900) return currentYear - yearValue;
  
  return undefined;
};
// Compute a relevance score for sorting candidates.
// Higher score = better match. Combines distance, interest overlap, age preference, recent activity, and profile completeness.
const computeMatchScore = (currentUser: any, candidate: any, distanceKm: number): number => {
  // weights (tweakable)
  const WEIGHT_DISTANCE = 0.35;
  const WEIGHT_INTEREST = 0.25;
  const WEIGHT_AGE = 0.15;
  const WEIGHT_ACTIVITY = 0.15;
  const WEIGHT_PROFILE = 0.10;

  // Distance factor: closer is better. Use 1 / (1 + km) to decay.
  const distanceFactor = Number.isFinite(distanceKm) && distanceKm >= 0 ? (1 / (1 + distanceKm)) : 0;

  // Interest overlap count normalized by average number of interests (avoid divide by zero)
  const overlap = computeInterestOverlapCount(currentUser.interest, candidate.interest);
  const currentCount = parseInterestList(currentUser.interest).length || 1;
  const candidateCount = parseInterestList(candidate.interest).length || 1;
  const avgCount = Math.max(1, (currentCount + candidateCount) / 2);
  const interestFactor = Math.min(overlap / avgCount, 1);

  // Age preference: boost if candidate within currentUser.ages..currentUser.secondages
  const minAge = toNumberOrUndefined(currentUser.ages) ?? undefined;
  const maxAge = toNumberOrUndefined(currentUser.secondages) ?? undefined;
  let ageFactor = 0.5; // neutral
  const candAge = toNumberOrUndefined(candidate.years);
  if (minAge != null && maxAge != null && candAge != null) {
    ageFactor = (candAge >= minAge && candAge <= maxAge) ? 1 : 0.2;
  }

  // Activity: recent lastActiveAt -> boost
  let activityFactor = 0.5;
  if (candidate.lastActiveAt) {
    const last = new Date(candidate.lastActiveAt).getTime();
    const now = Date.now();
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) activityFactor = 1.0;
    else if (diffDays <= 7) activityFactor = 0.8;
    else if (diffDays <= 30) activityFactor = 0.6;
    else activityFactor = 0.3;
  }

  // Profile completeness: images + profile text
  let profileCompleteness = 0;
  if (candidate.profile) profileCompleteness += 0.6;
  const images = ['im1','im2','im3','im4'].filter(k => candidate[k]).length;
  profileCompleteness += Math.min(images / 4, 1) * 0.4;

  // final score normalized to ~0..1
  const score = (
    WEIGHT_DISTANCE * distanceFactor +
    WEIGHT_INTEREST * interestFactor +
    WEIGHT_AGE * ageFactor +
    WEIGHT_ACTIVITY * activityFactor +
    WEIGHT_PROFILE * profileCompleteness
  );

  // Add very small jitter to avoid deterministic ordering
  return score + (Math.random() * 0.0001);
};

export const getPotentialMatches = async (req: Request, res: Response) => {
  try {
    const { 
      owner, 
      email, 
      from,        // Min age preference
      to,          // Max age preference
      wanttosee,   // Gender preference (MANDATORY)
      interest,    // Interest preference
      distance,    // Max distance preference
      fors,        // Relationship type preference
      Orientation, // Orientation preference
      country,     // Country preference
      city         // City preference
    } = req.method === 'POST' ? req.body : req.query;

    console.log('[PotentialMatches] Request params:', {
      owner, email, from, to, wanttosee, interest, distance, fors, Orientation, country, city
    });

    if (!owner || !email) {
      res.status(400).json({ message: "Owner and email are required", status: 0 });
      return;
    }

    const currentUser = await User.findOne({where:{ id: owner, email: email }});
    if (!currentUser) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    // Get users that current user has already swiped on
    const swipedUsers = await Match.findAll({
      where: { user_id: owner },
      attributes: ['matched_user_id'],
    });
    const swipedUserIds = swipedUsers.map(m => m.matched_user_id);

    // ===== STEP 1: MANDATORY BASE CONDITIONS =====
    // Only apply GENDER as a hard SQL filter
    // Everything else will be handled through prioritized filtering
    const baseConditions: any = {
      id: { [Op.and]: [{ [Op.ne]: owner }, { [Op.notIn]: swipedUserIds }] },
      aproved: 'YES',
      IsVerified: true,
      isBlocked: false,
      tester: false, // Exclude test accounts from matching
    };

    // MANDATORY: Gender filter (wanttosee) - this is the ONLY hard filter
    if (!wanttosee) {
      res.status(400).json({ message: "wanttosee (gender preference) is required", status: 0 });
      return;
    }
    baseConditions.gender = wanttosee;

    console.log('[PotentialMatches] Base conditions:', baseConditions);

    // Fetch all potential matches with mandatory gender filter only
    let allMatches = await User.findAll({
      where: baseConditions,
      limit: 1000,
    });

    console.log('[PotentialMatches] After gender filter:', allMatches.length);

    if (allMatches.length === 0) {
      res.status(200).json([]);
      return;
    }

    // ===== STEP 2: ENRICH DATA WITH COMPUTED VALUES =====
    const maxDistanceKm = toNumberOrUndefined(distance);
    const minAge = toNumberOrUndefined(from) || toNumberOrUndefined(currentUser.ages) || 18;
    const maxAge = toNumberOrUndefined(to) || toNumberOrUndefined(currentUser.secondages) || 100;
    
    const requestedCity = toTrimmedLower(city);
    const requestedCountry = toTrimmedLower(country);
    const requestedInterests = parseInterestList(interest || currentUser.interest);
    const requestedOrientation = toTrimmedLower(Orientation);
    const requestedFors = toTrimmedLower(fors);
    
    // Get current user's location as fallback
    const currentUserCity = toTrimmedLower(currentUser.city);
    const currentUserCountry = toTrimmedLower(currentUser.country);

    const enrichedMatches = allMatches.map((match) => {
      const m: any = match.toJSON();
      
      // Calculate distance
      m.computedDistance = computeCandidateDistanceKm(currentUser, m);
      
      // Calculate age
      m.computedAge = calculateAge(m.years);
      
      // Check age range match
      m.ageMatch = m.computedAge != null && m.computedAge >= minAge && m.computedAge <= maxAge;
      
      // Check location matches
      const candCity = toTrimmedLower(m.city);
      const candCountry = toTrimmedLower(m.country);
      
      // Use requested city/country, fallback to current user's location
      const targetCity = requestedCity && requestedCity !== 'null' ? requestedCity : currentUserCity;
      const targetCountry = requestedCountry && requestedCountry !== 'null' ? requestedCountry : currentUserCountry;
      
      m.cityMatch = targetCity && candCity ? candCity === targetCity : false;
      m.countryMatch = targetCountry && candCountry ? candCountry === targetCountry : false;
      
      // Check distance match
      m.distanceMatch = maxDistanceKm != null && m.computedDistance !== Infinity 
        ? m.computedDistance <= maxDistanceKm 
        : null; // null means no distance preference or coords missing
      
      // Check orientation match
      const candOrientation = toTrimmedLower(m.Orientation);
      m.orientationMatch = requestedOrientation && requestedOrientation !== 'null'
        ? candOrientation === requestedOrientation
        : true; // If no orientation specified, consider all as match
      
      // Check relationship type match
      const candFors = toTrimmedLower(m.fors);
      m.forsMatch = requestedFors && requestedFors !== 'null'
        ? candFors === requestedFors
        : true; // If no fors specified, consider all as match
      
      // Calculate interest overlap
      m.interestOverlap = requestedInterests.length > 0 
        ? computeInterestOverlapCount(interest || currentUser.interest, m.interest)
        : 0;
      
      return m;
    });

    // ===== STEP 3: PRIORITIZED FILTERING =====
    
    // Priority 1: Orientation + Fors + Same city + age range + distance
    let filteredMatches = enrichedMatches.filter(m => 
      m.orientationMatch &&
      m.forsMatch &&
      m.cityMatch && 
      m.ageMatch && 
      (m.distanceMatch === true || m.distanceMatch === null)
    );
    console.log('[Priority 1] Orientation + Fors + Same city + age + distance:', filteredMatches.length);

    // Priority 2: Orientation + Fors + Same country + age range + distance
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => 
        m.orientationMatch &&
        m.forsMatch &&
        m.countryMatch && 
        m.ageMatch && 
        (m.distanceMatch === true || m.distanceMatch === null)
      );
      console.log('[Priority 2] Orientation + Fors + Same country + age + distance:', filteredMatches.length);
    }

    // Priority 3: Orientation + Fors + Age range + distance (any location)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => 
        m.orientationMatch &&
        m.forsMatch &&
        m.ageMatch && 
        (m.distanceMatch === true || m.distanceMatch === null)
      );
      console.log('[Priority 3] Orientation + Fors + Age + distance:', filteredMatches.length);
    }

    // Priority 4: Orientation + Age range + distance (relax fors)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => 
        m.orientationMatch &&
        m.ageMatch && 
        (m.distanceMatch === true || m.distanceMatch === null)
      );
      console.log('[Priority 4] Orientation + Age + distance (relaxed fors):', filteredMatches.length);
    }

    // Priority 5: Age range + distance (relax orientation and fors)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => 
        m.ageMatch && 
        (m.distanceMatch === true || m.distanceMatch === null)
      );
      console.log('[Priority 5] Age + distance (relaxed orientation & fors):', filteredMatches.length);
    }

    // Priority 6: Age range only (ignore distance)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => m.ageMatch);
      console.log('[Priority 6] Age only:', filteredMatches.length);
    }

    // Priority 7: Distance + interests (relax age)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => 
        (m.distanceMatch === true || m.distanceMatch === null) && 
        m.interestOverlap > 0
      );
      console.log('[Priority 7] Distance + interests (relaxed age):', filteredMatches.length);
    }

    // Priority 8: Interests only (relax everything except gender)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches.filter(m => m.interestOverlap > 0);
      console.log('[Priority 8] Interests only:', filteredMatches.length);
    }

    // Priority 9: Return all remaining matches (only gender filter applied)
    if (filteredMatches.length === 0) {
      filteredMatches = enrichedMatches;
      console.log('[Priority 9] All matches (gender only):', filteredMatches.length);
    }

    // ===== STEP 4: SORTING BY RELEVANCE =====
    filteredMatches.sort((a, b) => {
      // 1. Orientation match first
      if (a.orientationMatch !== b.orientationMatch) return b.orientationMatch ? 1 : -1;
      
      // 2. Relationship type match second
      if (a.forsMatch !== b.forsMatch) return b.forsMatch ? 1 : -1;
      
      // 3. City match third
      if (a.cityMatch !== b.cityMatch) return b.cityMatch ? 1 : -1;
      
      // 4. Country match fourth
      if (a.countryMatch !== b.countryMatch) return b.countryMatch ? 1 : -1;
      
      // 5. Age match fifth
      if (a.ageMatch !== b.ageMatch) return b.ageMatch ? 1 : -1;
      
      // 6. Distance sixth (closer is better)
      const distA = a.computedDistance !== Infinity ? a.computedDistance : 999999;
      const distB = b.computedDistance !== Infinity ? b.computedDistance : 999999;
      if (distA !== distB) return distA - distB;
      
      // 7. Interest overlap seventh
      if (a.interestOverlap !== b.interestOverlap) return b.interestOverlap - a.interestOverlap;
      
      // 8. Profile completeness (images)
      const imagesA = ['im1','im2','im3','im4'].filter(k => a[k]).length;
      const imagesB = ['im1','im2','im3','im4'].filter(k => b[k]).length;
      if (imagesA !== imagesB) return imagesB - imagesA;
      
      return 0;
    });

    // ===== STEP 5: FORMAT AND RETURN =====
    const finalMatches = filteredMatches.slice(0, 50).map(m => {
      // Remove sensitive data
      delete m.password;
      delete m.OTP;
      delete m.OTPExpiry;
      
      // Format response
      return {
        ...m,
        age: m.computedAge,
        distance: m.computedDistance !== Infinity 
          ? Number(m.computedDistance.toFixed(2)) 
          : null,
        status: m.status,
        // Remove temporary fields
        computedDistance: undefined,
        computedAge: undefined,
        ageMatch: undefined,
        cityMatch: undefined,
        countryMatch: undefined,
        distanceMatch: undefined,
        orientationMatch: undefined,
        forsMatch: undefined,
        interestOverlap: undefined,
      };
    });
    console.log('[PotentialMatches] Returning:', finalMatches.length, 'matches');
    res.status(200).json(finalMatches);

  } catch (error: any) {
    console.error("Get potential matches error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Swipe Action (Like/Pass/Flag)
export const swipeAction = async (req: Request, res: Response) => {
  try {
    const { user, rec, direction } = req.body;
    let matchPayload: any = null;

    if (!user || !rec || !direction) {
      res.status(400).json({ message: "User, rec, and direction are required", status: 0 });
      return;
    }

    if (direction === 'flag_status') {
      const flagRecord = await Match.findOne({
        where: {
          user_id: user,
          matched_user_id: rec,
          status: 'flag',
        },
      });

      res.status(200).json({ status: 1, isFlagged: !!flagRecord });
      return;
    }

    if (direction === 'unflag') {
      const deletedCount = await Match.destroy({
        where: {
          user_id: user,
          matched_user_id: rec,
          status: 'flag',
        },
      });

      res.status(200).json({ status: 1, message: 'Flag removed', deletedCount });
      return;
    }

    if (direction === 'flag') {
      const existingFlag = await Match.findOne({
        where: {
          user_id: user,
          matched_user_id: rec,
          status: 'flag',
        },
      });

      if (!existingFlag) {
        await Match.create({
          user_id: user,
          matched_user_id: rec,
          status: 'flag',
        });
      }

      res.status(200).json({ status: 1, message: 'User flagged' });
      return;
    }

    const status = direction === 'right' ? 'like' : 'pass';

    const existingMatch = await Match.findOne({
      where: {
        user_id: user,
        matched_user_id: rec,
        status: { [Op.in]: ['like', 'pass', 'super_like'] },
      },
    });

    if (existingMatch) {
      await existingMatch.update({ status });
    } else {
      await Match.create({
        user_id: user,
        matched_user_id: rec,
        status,
      });
    }

    if (status === 'like') {
      const mutualMatch = await Match.findOne({
        where: {
          user_id: rec,
          matched_user_id: user,
          status: 'like',
        },
      });

      if (mutualMatch) {
        const user1 = await User.findByPk(user);
        const user2 = await User.findByPk(rec);

        if (user1 && user2) {
          matchPayload = {
            currentUser: {
              id: user1.id,
              f_name: user1.f_name,
              l_name: user1.l_name,
              profile: user1.profile,
            },
            matchedUser: {
              id: user2.id,
              f_name: user2.f_name,
              l_name: user2.l_name,
              profile: user2.profile,
            },
          };

          await Notification.create({
            user_id: rec,
            sender_id: user,
            title: "New Match",
            message: `You matched with ${user1.f_name || user1.email}!`,
            datesent: new Date(),
            is_read: false,
          });

          await Notification.create({
            user_id: user,
            sender_id: rec,
            title: "New Match",
            message: `You matched with ${user2.f_name || user2.email}!`,
            datesent: new Date(),
            is_read: false,
          });

          if (user2.push === 'true') {
            await sendPushNotification(Number(rec), "New Match", `You matched with ${user1.f_name || user1.email}!`);
          }
          if (user1.push === 'true') {
            await sendPushNotification(Number(user), "New Match", `You matched with ${user2.f_name || user2.email}!`);
          }
        }
      } else {
        const liker = await User.findByPk(user);
        const liked = await User.findByPk(rec);

        if (liked) {
          await liked.update({ newlikes: true });
        }

        if (liker && liked && liked.push === 'true') {
          await Notification.create({
            user_id: rec,
            sender_id: user,
            title: "New Like",
            message: `${liker.f_name || liker.email} liked you!`,
            datesent: new Date(),
            is_read: false,
          });

          if (liked.push === 'true') {
            await sendPushNotification(Number(rec), "New Like", `${liker.f_name || liker.email} liked you!`);
          }
        }
      }
    }

    res.status(200).json({ message: "Swipe recorded", status: 1, matched: !!matchPayload, match: matchPayload });
  } catch (error: any) {
    console.error("Swipe action error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get Matches
export const getMatches = async (req: Request, res: Response) => {
  try {
    const { matchess } = req.query;
    const userId = Number(matchess);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const matches = await Match.findAll({
      where: {
        user_id: userId,
        status: 'like',
      },
      include: [{
        model: User,
        as: 'matchedUser',
        attributes: ['id', 'f_name', 'l_name', 'profile', 'years', 'city', 'country', 'status'],
        required: false,
      }],
    });

    const mutualMatches = [];
    for (const match of matches) {
      const flaggedRecord = await Match.findOne({
        where: {
          user_id: userId,
          matched_user_id: match.matched_user_id,
          status: 'flag',
        },
      });

      if (flaggedRecord) {
        continue;
      }

      const reverseMatch = await Match.findOne({
        where: {
          user_id: match.matched_user_id,
          matched_user_id: userId,
          status: 'like',
        },
      });

      if (reverseMatch) {
        const matchedUser = await User.findByPk(match.matched_user_id);
        if (matchedUser) {
          const matchData: any = matchedUser.toJSON();
          if (matchData.password) delete matchData.password;
          if (matchData.OTP) delete matchData.OTP;
          if (matchData.OTPExpiry) delete matchData.OTPExpiry;
          mutualMatches.push({
            ...matchData,
            available: matchData.status,
          });
        }
      }
    }

    res.status(200).json(mutualMatches);
  } catch (error: any) {
    console.error("Get matches error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get All Likes (Only NEW likes - excludes already matched users)
export const getAllLikes = async (req: Request, res: Response) => {
  try {
    const { alllist } = req.query;
    const userId = Number(alllist);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const likes = await Match.findAll({
      where: {
        matched_user_id: userId,
        status: 'like',
      },
    });

    const newlikesData = [];
    for (const like of likes) {
      const flaggedRecord = await Match.findOne({
        where: {
          user_id: userId,
          matched_user_id: like.user_id,
          status: 'flag',
        },
      });

      if (flaggedRecord) {
        continue;
      }

      const reverseMatch = await Match.findOne({
        where: {
          user_id: userId,
          matched_user_id: like.user_id,
          status: 'like',
        },
      });

      if (!reverseMatch) {
        const user = await User.findByPk(like.user_id);
        if (user) {
          const data: any = user.toJSON();
          if (data.password) delete data.password;
          if (data.OTP) delete data.OTP;
          if (data.OTPExpiry) delete data.OTPExpiry;
          newlikesData.push(data);
        }
      }
    }

    res.status(200).json(newlikesData);
  } catch (error: any) {
    console.error("Get all likes error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get Top Picks
export const getTopPicks = async (req: Request, res: Response) => {
  try {
    const { 
      owner, 
      user, 
      email, 
      from,        // Min age preference
      to,          // Max age preference
      wanttosee,   // Gender preference
      interest, 
      distance, 
      fors, 
      Orientation, 
      country,     // Country preference
      city 
    } = req.body;
    
    // Use 'owner' if provided, otherwise fall back to 'user'
    const userId = owner || user;

    console.log('[TopPicks] Request params:', {
      userId, email, from, to, wanttosee, interest, distance, fors, Orientation, country, city
    });

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const currentUser = await User.findByPk(userId);
    if (!currentUser) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    // Get users that current user has already swiped on
    const swipedUsers = await Match.findAll({
      where: { user_id: userId },
      attributes: ['matched_user_id'],
    });
    const swipedUserIds = swipedUsers.map(m => m.matched_user_id);

    // ===== STEP 1: BASE CONDITIONS =====
    // Only apply gender as mandatory filter
    const baseConditions: any = {
      id: { [Op.and]: [{ [Op.ne]: userId }, { [Op.notIn]: swipedUserIds }] },
      aproved: 'YES',
      IsVerified: true,
      isBlocked: false,
      tester: false, // Exclude test accounts from matching
    };

    // MANDATORY: Gender filter (wanttosee)
    if (!wanttosee) {
      res.status(400).json({ message: "wanttosee (gender preference) is required", status: 0 });
      return;
    }
    baseConditions.gender = wanttosee;

    console.log('[TopPicks] Base conditions:', baseConditions);

    // Fetch ALL users matching gender (we'll prioritize by toppicks and globe later)
    let allUsers = await User.findAll({
      where: baseConditions,
      limit: 1000,
    });

    console.log('[TopPicks] After gender filter:', allUsers.length);

    if (allUsers.length === 0) {
      res.status(200).json([]);
      return;
    }

    // ===== STEP 2: ENRICH DATA =====
    const minAge = toNumberOrUndefined(from) || toNumberOrUndefined(currentUser.ages) || 18;
    const maxAge = toNumberOrUndefined(to) || toNumberOrUndefined(currentUser.secondages) || 100;
    const maxDistanceKm = toNumberOrUndefined(distance);
    
    const requestedCountry = toTrimmedLower(country);
    const currentUserCountry = toTrimmedLower(currentUser.country);
    const targetCountry = requestedCountry && requestedCountry !== 'null' ? requestedCountry : currentUserCountry;

    const enrichedUsers = allUsers.map((user) => {
      const u: any = user.toJSON();
      
      // Calculate age
      u.computedAge = calculateAge(u.years);
      u.ageMatch = u.computedAge != null && u.computedAge >= minAge && u.computedAge <= maxAge;
      
      // Calculate distance
      u.computedDistance = computeCandidateDistanceKm(currentUser, u);
      u.distanceMatch = maxDistanceKm != null && u.computedDistance !== Infinity 
        ? u.computedDistance <= maxDistanceKm 
        : null;
      
      // Country match
      const candCountry = toTrimmedLower(u.country);
      u.countryMatch = targetCountry && candCountry ? candCountry === targetCountry : false;
      
      // Check toppicks and globe flags (handle both 'true' string and boolean true)
      u.hasTopPicks = u.toppicks === 'true' || u.toppicks === true;
      u.hasGlobe = u.globe === 'true' || u.globe === true;
      
      // Calculate match score for sorting
      u._score = computeMatchScore(currentUser, u, u.computedDistance);
      
      // Boost score for paid/premium users
      if (u.subs && u.subs !== 'FREE') {
        u._score += 0.05;
      }
      
      return u;
    });

    // ===== STEP 3: PRIORITIZED FILTERING =====
    // This creates multiple tiers of matches based on priority
    
    // PRIORITY 1: toppicks=true + globe=false + age + country + distance
    // (Users who opted into top picks but only in their country)
    let tier1 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      (u.distanceMatch === true || u.distanceMatch === null)
    );
    console.log('[TopPicks Priority 1] toppicks + !globe + age + country + distance:', tier1.length);

    // PRIORITY 2: toppicks=true + globe=false + age + country (ignore distance)
    let tier2 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      !tier1.includes(u)
    );
    console.log('[TopPicks Priority 2] toppicks + !globe + age + country (any distance):', tier2.length);

    // PRIORITY 3: toppicks=true + globe=true + age + country + distance
    // (Global users in same country with distance match)
    let tier3 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      (u.distanceMatch === true || u.distanceMatch === null) &&
      !tier1.includes(u) &&
      !tier2.includes(u)
    );
    console.log('[TopPicks Priority 3] toppicks + globe + age + country + distance:', tier3.length);

    // PRIORITY 4: toppicks=true + globe=true + age + country (ignore distance)
    let tier4 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u)
    );
    console.log('[TopPicks Priority 4] toppicks + globe + age + country (any distance):', tier4.length);

    // PRIORITY 5: toppicks=true + globe=true + age (ANY LOCATION - worldwide)
    let tier5 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u) &&
      !tier4.includes(u)
    );
    console.log('[TopPicks Priority 5] toppicks + globe + age (worldwide):', tier5.length);

    // PRIORITY 6: toppicks=true + globe=false (relax age, but still same country only)
    let tier6 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.countryMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u)
    );
    console.log('[TopPicks Priority 6] toppicks + !globe + country (relaxed age):', tier6.length);

    // PRIORITY 7: toppicks=true + globe=true (relax age and location - show everyone globally)
    let tier7 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u) &&
      !tier4.includes(u) &&
      !tier5.includes(u)
    );
    console.log('[TopPicks Priority 7] toppicks + globe (relaxed age, worldwide):', tier7.length);

    // ===== STEP 4: SORT EACH TIER BY SCORE =====
    const sortByScore = (a: any, b: any) => {
      // First by age match
      if (a.ageMatch !== b.ageMatch) return b.ageMatch ? 1 : -1;
      
      // Then by country match
      if (a.countryMatch !== b.countryMatch) return b.countryMatch ? 1 : -1;
      
      // Then by distance
      const distA = a.computedDistance !== Infinity ? a.computedDistance : 999999;
      const distB = b.computedDistance !== Infinity ? b.computedDistance : 999999;
      if (distA !== distB) return distA - distB;
      
      // Finally by computed score
      return (b._score || 0) - (a._score || 0);
    };

    tier1.sort(sortByScore);
    tier2.sort(sortByScore);
    tier3.sort(sortByScore);
    tier4.sort(sortByScore);
    tier5.sort(sortByScore);
    tier6.sort(sortByScore);
    tier7.sort(sortByScore);

    // ===== STEP 5: COMBINE TIERS IN ORDER =====
    const combinedTopPicks = [
      ...tier1,
      ...tier2,
      ...tier3,
      ...tier4,
      ...tier5,
      ...tier6,
      ...tier7
    ];

    console.log('[TopPicks] Total combined picks:', combinedTopPicks.length);

    // ===== STEP 6: FORMAT AND RETURN =====
    const picksData = combinedTopPicks.slice(0, 50).map(pick => {
      const data: any = pick;
      
      // Remove sensitive data
      delete data.password;
      delete data.OTP;
      delete data.OTPExpiry;
      
      // Format response
      return {
        ...data,
        age: data.computedAge,
        distance: data.computedDistance !== Infinity 
          ? Number(data.computedDistance.toFixed(2)) 
          : null,
        status: data.status,
        score: data._score ? Number(data._score.toFixed(4)) : undefined,
        // Remove temporary fields
        computedDistance: undefined,
        computedAge: undefined,
        ageMatch: undefined,
        countryMatch: undefined,
        distanceMatch: undefined,
        hasTopPicks: undefined,
        hasGlobe: undefined,
        _score: undefined,
      };
    });

    console.log('[TopPicks] Returning:', picksData.length, 'picks');
    res.status(200).json(picksData);
  } catch (error: any) {
    console.error("Get top picks error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};


// Get Top Picks
export const filteredExplore = async (req: Request, res: Response) => {
  try {
    const { 
      owner, 
      user, 
      email, 
      from,        // Min age preference
      to,          // Max age preference
      wanttosee,   // Gender preference
      interest, 
      distance, 
      fors, 
      Orientation, 
      country,     // Country preference
      city 
    } = req.body;
    
    // Use 'owner' if provided, otherwise fall back to 'user'
    const userId = owner || user;

    console.log('[TopPicks] Request params:', {
      userId, email, from, to, wanttosee, interest, distance, fors, Orientation, country, city
    });

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const currentUser = await User.findByPk(userId);
    if (!currentUser) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    // Get users that current user has already swiped on
    const swipedUsers = await Match.findAll({
      where: { user_id: userId },
      attributes: ['matched_user_id'],
    });
    const swipedUserIds = swipedUsers.map(m => m.matched_user_id);

    // ===== STEP 1: BASE CONDITIONS =====
    // Only apply gender as mandatory filter
    const baseConditions: any = {
      id: { [Op.and]: [{ [Op.ne]: userId }, { [Op.notIn]: swipedUserIds }] },
      aproved: 'YES',
      IsVerified: true,
      isBlocked: false,
      tester: false, // Exclude test accounts from matching
    };

    // MANDATORY: Gender filter (wanttosee)
    if (!wanttosee) {
      res.status(400).json({ message: "wanttosee (gender preference) is required", status: 0 });
      return;
    }
    baseConditions.gender = wanttosee;

    const selectedFors = typeof fors === 'string' ? fors.trim() : '';
    if (selectedFors && toTrimmedLower(selectedFors) !== 'all') {
      baseConditions.fors = selectedFors;
    }

    console.log('[TopPicks] Base conditions:', baseConditions);

    // Fetch ALL users matching gender (we'll prioritize by toppicks and globe later)
    let allUsers = await User.findAll({
      where: baseConditions,
      limit: 1000,
    });

    console.log('[TopPicks] After gender filter:', allUsers.length);

    if (allUsers.length === 0) {
      res.status(200).json([]);
      return;
    }

    // ===== STEP 2: ENRICH DATA =====
    const minAge = toNumberOrUndefined(from) || toNumberOrUndefined(currentUser.ages) || 18;
    const maxAge = toNumberOrUndefined(to) || toNumberOrUndefined(currentUser.secondages) || 100;
    const maxDistanceKm = toNumberOrUndefined(distance);
    
    const requestedCountry = toTrimmedLower(country);
    const currentUserCountry = toTrimmedLower(currentUser.country);
    const targetCountry = requestedCountry && requestedCountry !== 'null' ? requestedCountry : currentUserCountry;

    const enrichedUsers = allUsers.map((user) => {
      const u: any = user.toJSON();
      
      // Calculate age
      u.computedAge = calculateAge(u.years);
      u.ageMatch = u.computedAge != null && u.computedAge >= minAge && u.computedAge <= maxAge;
      
      // Calculate distance
      u.computedDistance = computeCandidateDistanceKm(currentUser, u);
      u.distanceMatch = maxDistanceKm != null && u.computedDistance !== Infinity 
        ? u.computedDistance <= maxDistanceKm 
        : null;
      
      // Country match
      const candCountry = toTrimmedLower(u.country);
      u.countryMatch = targetCountry && candCountry ? candCountry === targetCountry : false;
      
      // Check toppicks and globe flags (handle both 'true' string and boolean true)
      u.hasTopPicks = u.toppicks === 'true' || u.toppicks === true;
      u.hasGlobe = u.globe === 'true' || u.globe === true;
      
      // Calculate match score for sorting
      u._score = computeMatchScore(currentUser, u, u.computedDistance);
      
      // Boost score for paid/premium users
      if (u.subs && u.subs !== 'FREE') {
        u._score += 0.05;
      }
      
      return u;
    });

    // ===== STEP 3: PRIORITIZED FILTERING =====
    // This creates multiple tiers of matches based on priority
    
    // PRIORITY 1: toppicks=true + globe=false + age + country + distance
    // (Users who opted into top picks but only in their country)
    let tier1 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      (u.distanceMatch === true || u.distanceMatch === null)
    );
    console.log('[TopPicks Priority 1] toppicks + !globe + age + country + distance:', tier1.length);

    // PRIORITY 2: toppicks=true + globe=false + age + country (ignore distance)
    let tier2 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      !tier1.includes(u)
    );
    console.log('[TopPicks Priority 2] toppicks + !globe + age + country (any distance):', tier2.length);

    // PRIORITY 3: toppicks=true + globe=true + age + country + distance
    // (Global users in same country with distance match)
    let tier3 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      (u.distanceMatch === true || u.distanceMatch === null) &&
      !tier1.includes(u) &&
      !tier2.includes(u)
    );
    console.log('[TopPicks Priority 3] toppicks + globe + age + country + distance:', tier3.length);

    // PRIORITY 4: toppicks=true + globe=true + age + country (ignore distance)
    let tier4 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      u.countryMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u)
    );
    console.log('[TopPicks Priority 4] toppicks + globe + age + country (any distance):', tier4.length);

    // PRIORITY 5: toppicks=true + globe=true + age (ANY LOCATION - worldwide)
    let tier5 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      u.ageMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u) &&
      !tier4.includes(u)
    );
    console.log('[TopPicks Priority 5] toppicks + globe + age (worldwide):', tier5.length);

    // PRIORITY 6: toppicks=true + globe=false (relax age, but still same country only)
    let tier6 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      !u.hasGlobe &&
      u.countryMatch &&
      !tier1.includes(u) &&
      !tier2.includes(u)
    );
    console.log('[TopPicks Priority 6] toppicks + !globe + country (relaxed age):', tier6.length);

    // PRIORITY 7: toppicks=true + globe=true (relax age and location - show everyone globally)
    let tier7 = enrichedUsers.filter(u => 
      u.hasTopPicks &&
      u.hasGlobe &&
      !tier1.includes(u) &&
      !tier2.includes(u) &&
      !tier3.includes(u) &&
      !tier4.includes(u) &&
      !tier5.includes(u)
    );
    console.log('[TopPicks Priority 7] toppicks + globe (relaxed age, worldwide):', tier7.length);

    // ===== STEP 4: SORT EACH TIER BY SCORE =====
    const sortByScore = (a: any, b: any) => {
      // First by age match
      if (a.ageMatch !== b.ageMatch) return b.ageMatch ? 1 : -1;
      
      // Then by country match
      if (a.countryMatch !== b.countryMatch) return b.countryMatch ? 1 : -1;
      
      // Then by distance
      const distA = a.computedDistance !== Infinity ? a.computedDistance : 999999;
      const distB = b.computedDistance !== Infinity ? b.computedDistance : 999999;
      if (distA !== distB) return distA - distB;
      
      // Finally by computed score
      return (b._score || 0) - (a._score || 0);
    };

    tier1.sort(sortByScore);
    tier2.sort(sortByScore);
    tier3.sort(sortByScore);
    tier4.sort(sortByScore);
    tier5.sort(sortByScore);
    tier6.sort(sortByScore);
    tier7.sort(sortByScore);

    // ===== STEP 5: COMBINE TIERS IN ORDER =====
    const combinedTopPicks = [
      ...tier1,
      ...tier2,
      ...tier3,
      ...tier4,
      ...tier5,
      ...tier6,
      ...tier7
    ];

    console.log('[TopPicks] Total combined picks:', combinedTopPicks.length);

    // ===== STEP 6: FORMAT AND RETURN =====
    const picksData = combinedTopPicks.slice(0, 50).map(pick => {
      const data: any = pick;
      
      // Remove sensitive data
      delete data.password;
      delete data.OTP;
      delete data.OTPExpiry;
      
      // Format response
      return {
        ...data,
        age: data.computedAge,
        distance: data.computedDistance !== Infinity 
          ? Number(data.computedDistance.toFixed(2)) 
          : null,
        status: data.status,
        score: data._score ? Number(data._score.toFixed(4)) : undefined,
        // Remove temporary fields
        computedDistance: undefined,
        computedAge: undefined,
        ageMatch: undefined,
        countryMatch: undefined,
        distanceMatch: undefined,
        hasTopPicks: undefined,
        hasGlobe: undefined,
        _score: undefined,
      };
    });

    console.log('[TopPicks] Returning:', picksData.length, 'picks');
    res.status(200).json(picksData);
  } catch (error: any) {
    console.error("Get top picks error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};
// Reset newlikes flag
export const resetNewLikes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ newlikes: false });
    }

    res.status(200).json({ message: "New likes flag reset", status: 1 });
  } catch (error: any) {
    console.error("Reset newlikes error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};
