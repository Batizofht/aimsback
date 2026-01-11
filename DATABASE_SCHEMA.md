# Database Schema Overview

## Tables Created

### 1. **users** (User Model)
Complete user profile and settings:
- **Authentication**: id, email, phone, password, OTP, OTPExpiry, IsVerified
- **Profile**: f_name, l_name, profile (picture), bio, years (birth year)
- **Location**: city, country, lats, longs
- **Preferences**: ages, secondages (age range), distance, looking, fors (gender), Orientation, interest
- **Education**: education, schoolname
- **Images**: im1, im2, im3, im4 (slider images)
- **Settings**: globe, toppicks, emailnotification, push, subs (subscription)
- **Status**: aproved, progress

### 2. **matches** (Match Model)
Tracks all swipe actions:
- id, user_id, matched_user_id, status ('like', 'pass', 'super_like')
- Timestamps for when swipe occurred

### 3. **messages** (Message Model)
Chat messages between users:
- id, msg_id, sender_id, receiver_id, message, date
- Supports both text and image messages (image filename stored in message field)

### 4. **notifications** (Notification Model)
User notifications:
- id, user_id, sender_id, message, title, datesent
- Used for likes, matches, and other events

### 5. **push_tokens** (PushToken Model)
Expo push notification tokens:
- id, user_id, token
- Multiple tokens per user supported

## Relationships

- User → Matches (one-to-many)
- User → Messages (one-to-many, as sender and receiver)
- User → Notifications (one-to-many)
- User → PushTokens (one-to-many)
- Match → User (many-to-one, for both user and matched_user)

## All Required Fields Covered ✅

The schema supports all frontend functionality:
- ✅ User registration and authentication
- ✅ Profile management (all fields)
- ✅ Swiping and matching system
- ✅ Messaging (text and images)
- ✅ Notifications
- ✅ Push notifications
- ✅ Location tracking
- ✅ Subscription support (subs field)
- ✅ Super likes (in Match status)

## Ready for Production

All tables include:
- Primary keys with auto-increment
- Foreign key relationships
- Timestamps (createdAt, updatedAt)
- Proper data types
- Default values where needed

