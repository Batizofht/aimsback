# Photo Review System - Implementation Documentation

## Overview
Implemented a complete photo review system for the Admin UI with the following features:
- Admin can approve/reject user photos
- Users with pending/rejected photos are excluded from swipe feed
- Rejected users see a banner in their profile with rejection reason
- Notifications are sent when photos are rejected
- Admin can re-reject accidentally approved users

---

## Files Modified

### 1. `meintoyou/src/admin/AdminUsers.tsx`
**Changes:**
- Added `PhotoUserRow` type extending `UserRow` with photo-related fields
- Added state variables: `activeTab`, `pendingUsers`, `rejectedUsers`, `loadingPhotos`, `rejectReason`, `reviewing`, `photoStatusFilter`
- Added `loadPendingPhotos()` and `loadRejectedPhotos()` functions to fetch pending/rejected users
- Added `reviewPhoto()` function with loading state and live button updates
- Added tab navigation for "All Users", "Pending Photos", "Rejected Photos"
- Added photo status stats cards (Pending, Approved, Rejected counts)
- Added photo status filter dropdown
- Added "View Images" button in user actions with rejection reason auto-fill
- Added image modal with approve/reject actions
- Added "Reject" button for approved users (to fix accidental approvals)
- Added loading spinners on all action buttons
- Live button updates: Modal buttons change immediately after approve/reject

**Key Features:**
- Default rejection reason: "Your image(s) does not meet our community guidelines"
- Editable rejection reason textarea
- Buttons disabled during API calls with loading state
- Photo status badge in modal header (Pending Review / Rejected)

---

### 2. `server/utils/photoReview.ts` (NEW FILE)
**Functions Added:**
- `setPhotoPending(userId)` - Sets user photo to pending when new photos uploaded
- `queueOrSendNotification(userId, notification)` - Queues notifications for pending/rejected users
- `releaseHeldNotifications(userId)` - Sends queued notifications when user approved
- `approveUserPhoto(userId, adminId)` - Approves user photo with upsert logic
- `rejectUserPhoto(userId, adminId, reason)` - Rejects user photo with reason
- `sendRejectionNotifications(user, reason)` - Sends push + in-app notification to rejected user
- `getPhotoRejectReason(userId)` - Fetches rejection reason for rejected users

**Key Implementation:**
- Uses `findOrCreate` to handle legacy users without UserPhotoReview records
- `heldNotifications` JSON field for queuing notifications
- Error handling with granular try/catch blocks

---

### 3. `server/controllers/ProfileController.ts`
**Changes:**
- Imported `setPhotoPending` from photoReview utils
- Modified `updateProfilePicture()` to call `setPhotoPending()` after saving profile picture
- Modified `uploadMultipleImages()` to call `setPhotoPending()` after saving gallery images

**Purpose:**
- Automatically sets user photo status to "pending" when they upload new photos
- Triggers admin review workflow

---

### 4. `server/controllers/SwipeController.ts`
**Changes:**
- Added `photoStatus='approved'` filter to baseConditions in main swipe query
- Added `photoStatus='approved'` filter to TopPicks function

**Purpose:**
- Users with pending or rejected photos are excluded from swipe candidates
- Only approved users appear in the swipe feed

---

### 5. `server/controllers/AdminController.ts`
**Changes:**
- Imported photo review functions from utils
- Added `adminListPendingPhotos()` - Lists users with pending photos
- Added `adminListRejectedPhotos()` - Lists users with rejected photos
- Added `adminReviewPhoto()` - Handles approve/reject actions with error logging

**Error Handling:**
- Detailed console logging for debugging 500 errors
- Returns error message in response

---

### 6. `server/routes/UserRoute.ts`
**Changes:**
- Added imports for admin photo review functions
- Added route: `GET /admin/photos/pending` - List pending photos
- Added route: `GET /admin/photos/rejected` - List rejected photos
- Added route: `POST /admin/photos/:id/review` - Review (approve/reject) photo

---

### 7. `server/models/UserPhotoReview.ts` (NEW FILE)
**Model Definition:**
- Fields: `id`, `userId`, `photoRejectReason`, `photoSubmittedAt`, `photoReviewedAt`, `rejectionNotifiedAt`, `photoReviewerId`, `heldNotifications` (JSON)
- Table name: `UserPhotoReviews`
- Associations: Belongs to User

---

### 8. `server/models/User.ts`
**Changes:**
- Added `photoStatus` field to User interface (enum: 'pending' | 'approved' | 'rejected')
- Added photo-related fields: `photoSubmittedAt`, `photoRejectReason`, `photoReviewedAt`

---

### 9. `server/models/associations.ts`
**Changes:**
- Added `UserPhotoReview` import
- Added `User.hasOne(UserPhotoReview)` association
- Added `UserPhotoReview.belongsTo(User)` association

---

### 10. `server/migrations/20250422000000-create-user-photo-reviews.js` (NEW FILE)
**Migration:**
- Creates `UserPhotoReviews` table with all photo review fields
- Adds `photoStatus` ENUM column to `users` table
- Migrates existing users with photos to 'approved' status
- Uses lowercase table names for Supabase compatibility
- Idempotent - checks if table/column exists before creating

---

### 11. `server/cron/photoReviewReminders.ts` (NEW FILE)
**Cron Job:**
- Runs every 6 hours
- Sends reminder notifications to rejected users
- Message: "Reminder: Please upload a new photo to continue using the app"
- Starts automatically when server starts

---

### 12. `server/server.ts`
**Changes:**
- Added import for photo review reminders cron job
- Added `startPhotoReviewReminders()` call on server start

---

### 13. `meintoyouapp/Screens/Profile.js`
**Changes:**
- Added photo rejection banner at top of profile screen
- Shows when `userData?.photoStatus === 'rejected'`
- Displays rejection reason from `userData?.photoRejectReason`
- "Update Photo" button navigates to 'Mypic' screen
- Added dark mode support for banner
- Added styles for banner layout

**Message:**
- Title: "Image(s) Rejected"
- Default reason: "Your image(s) does not meet our community guidelines. Please upload a new photo."

---

### 14. `server/config/config.json` (NEW FILE)
**Purpose:**
- Created for Sequelize CLI compatibility
- Contains Supabase PostgreSQL credentials
- Separate configs for development, test, production

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/vava/admin/photos/pending` | GET | List users with pending photos |
| `/vava/admin/photos/rejected` | GET | List users with rejected photos |
| `/vava/admin/photos/:id/review` | POST | Approve or reject user photo |

**POST /vava/admin/photos/:id/review Body:**
```json
{
  "action": "approve" | "reject",
  "reason": "Rejection reason (required for reject)"
}
```

---

## Database Schema Changes

### Users Table
Added columns:
- `photoStatus` (ENUM: 'pending', 'approved', 'rejected') - Default: 'pending'

### UserPhotoReviews Table (NEW)
Columns:
- `id` (INTEGER, PK)
- `userId` (INTEGER, FK to users)
- `photoRejectReason` (STRING 500)
- `photoSubmittedAt` (DATE)
- `photoReviewedAt` (DATE)
- `rejectionNotifiedAt` (DATE)
- `photoReviewerId` (INTEGER)
- `heldNotifications` (JSON)
- `createdAt`, `updatedAt` (DATE)

---

## User Flow

1. **User uploads photo** → `setPhotoPending()` called → Status = 'pending'
2. **Admin reviews** → Opens image modal → Can approve or reject with reason
3. **If rejected**:
   - User sees red banner in profile
   - Push notification sent
   - In-app notification created
   - User excluded from swipe feed
4. **If approved**:
   - Queued notifications sent
   - User appears in swipe feed

---

## Migration Commands

```bash
# Run migrations (creates tables and columns)
npx sequelize-cli db:migrate --config config/config.json

# Check migration status
npx sequelize-cli db:migrate:status --config config/config.json
```

---

## Testing Checklist

- [ ] Upload photo → User status becomes 'pending'
- [ ] Pending users don't appear in swipe feed
- [ ] Admin sees pending users in "Pending Photos" tab
- [ ] Admin can reject with custom reason
- [ ] Rejected user sees banner in profile
- [ ] Rejected user receives push notification
- [ ] Rejected user receives in-app notification
- [ ] Rejected users don't appear in swipe feed
- [ ] Admin can approve rejected user
- [ ] Approved user appears in swipe feed
- [ ] Admin can re-reject approved user
- [ ] Loading spinners appear on buttons during API calls
- [ ] Modal buttons update live after action

---

## Error Handling

All functions include:
- Try/catch blocks with specific error messages
- Console logging for server-side debugging
- Error responses with detailed messages
- Graceful handling of missing UserPhotoReview records (upsert pattern)
