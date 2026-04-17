# SwipeController Documentation

## Overview
This controller handles all swipe-related functionality for the MeIntoYou dating app, including potential match discovery, swipe actions, and mutual matching.

## File Location
`server/controllers/SwipeController.ts`

## Exported Functions

### 1. `getPotentialMatches`
Fetches potential matches for a user to swipe on using a 9-tier progressive fallback algorithm.

**Endpoint:** `GET/POST /api/potential-matches`

**Parameters:**
- `owner` (required): User ID
- `email` (required): User email for verification
- `from`: Min age preference
- `to`: Max age preference
- `wanttosee` (required): Gender preference
- `interest`: Interest preference
- `distance`: Max distance (km)
- `fors`: Relationship type preference
- `Orientation`: Sexual orientation preference
- `country`: Country preference
- `city`: City preference

**Algorithm:**
1. **Base Filter:** Gender only (mandatory), exclude already swiped, unverified, blocked users
2. **Enrichment:** Calculate distance, age, and match flags for each candidate
3. **9-Tier Priority Fallback:**
   - Priority 1: Orientation + Fors + City + Age + Distance
   - Priority 2: Relax city → country
   - Priority 3: Relax location entirely
   - Priority 4: Relax relationship type
   - Priority 5: Relax orientation
   - Priority 6: Age only
   - Priority 7: Distance + Interests
   - Priority 8: Interests only
   - Priority 9: Gender only
4. **Sorting:** Orientation → Fors → City → Country → Age → Distance → Interests → Profile completeness
5. **Return:** Top 50 matches

**Age Logic:**
```typescript
const minAge = toNumberOrUndefined(from) ?? toNumberOrUndefined(currentUser.ages) ?? 18;
const maxAge = toNumberOrUndefined(to) ?? toNumberOrUndefined(currentUser.secondages) ?? 100;
```
Uses nullish coalescing (??) so age 0 is valid, unlike || which treats 0 as falsy.

---

### 2. `swipeAction`
Records a swipe action (like/pass/flag/unflag) and handles mutual matching.

**Endpoint:** `POST /api/swipe`

**Parameters:**
- `user` (required): Swiper user ID
- `rec` (required): Recipient user ID
- `direction` (required): 'right' | 'left' | 'flag' | 'unflag' | 'flag_status'

**Actions:**
- `right` → Records 'like', checks for mutual match
- `left` → Records 'pass'
- `flag` → Flags user (hides from future matches)
- `unflag` → Removes flag
- `flag_status` → Returns if user is currently flagged

**Mutual Match Logic:**
When both users like each other:
1. Creates match payload with both user profiles
2. Creates notifications for both users (in-app)
3. Sends push notifications if enabled

**New Like Logic:**
When one user likes another:
1. Sets `newlikes = true` on liked user's record
2. Creates in-app notification **always**
3. Sends push notification **only if** `push === 'true'`

---

### 3. `getMatches`
Fetches all mutual matches (conversations) for a user.

**Endpoint:** `GET /api/matches?matchess={userId}`

**Logic:**
- Finds all users current user has liked
- Verifies mutual like (other user also liked current user)
- Excludes flagged users
- Returns matched user data with online status

---

### 4. `getAllLikes`
Fetches all new likes (users who liked current user but haven't been liked back).

**Endpoint:** `GET /api/all-likes?alllist={userId}`

**Logic:**
- Finds all users who liked current user
- Excludes flagged users
- Excludes mutual matches (already matched)
- Returns array of users who liked current user

---

### 5. `getTopPicks`
Fetches "Top Picks" - premium feature for users who opted in to be featured.

**Endpoint:** `POST /api/top-picks`

**7-Tier Priority System:**
1. Top picks + local only + age + country + distance
2. Top picks + local only + age + country (any distance)
3. Top picks + global + age + country + distance
4. Top picks + global + age + country (any distance)
5. Top picks + global + age (worldwide)
6. Top picks + local only + country (relaxed age)
7. Top picks + global (relaxed age, worldwide)

**Paid User Boost:** Subscribers (`subs !== 'FREE'`) get +0.05 score boost.

---

### 6. `filteredExplore`
Nearly identical to `getTopPicks` but adds optional `fors` filter for the Explore feature.

**Difference:** Supports filtering by relationship type in base conditions.

---

### 7. `resetNewLikes`
Resets the `newlikes` flag on a user after they've viewed their new likes.

**Endpoint:** `POST /api/reset-newlikes`

---

## Helper Functions

### `toNumberOrUndefined(value: any): number | undefined`
Safely converts value to number or returns undefined.

### `toTrimmedLower(value: any): string`
Normalizes strings: trim whitespace + lowercase.

### `parseInterestList(value: any): string[]`
Parses comma-separated interests into normalized array.

### `computeInterestOverlapCount(a: any, b: any): number`
Counts shared interests between two users using Set intersection.

### `computeCandidateDistanceKm(currentUser: any, candidate: any): number`
Calculates Haversine distance between two users' coordinates.

### `calculateAge(years: any): number | undefined`
Converts birth year to age, or returns value if already an age.

### `computeMatchScore(currentUser: any, candidate: any, distanceKm: number): number`
Calculates relevance score (0-1) using weighted factors:
- Distance: 35%
- Interest overlap: 25%
- Age preference: 15%
- Recent activity: 15%
- Profile completeness: 10%

---

## Security Features

- SQL injection prevention via Sequelize operators
- Sensitive data stripped before response (password, OTP, OTPExpiry)
- Input validation before database queries
- Type coercion via helper functions

## Database Dependencies

- `User` model - User data
- `Match` model - Swipe records
- `Notification` model - In-app notifications

## Utility Dependencies

- `calculateDistance` - Haversine formula for geo-distance
- `sendPushNotification` - Firebase push notification service

---

## Notes

- All functions use `any` types for flexibility (can be refined with interfaces)
- `aproved` field name matches database schema (not a typo)
- Console logs prefixed with `[FunctionName]` for debugging
- Returns max 50 results per query
- Fetches max 1000 users from DB before in-memory filtering
