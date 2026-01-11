# MeIntoYou Backend

Node.js/Express backend for MeIntoYou dating app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Create a `.env` file
- Add your database connection string
- Add email configuration (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)
- Add FRONTEND_URL for password reset links

3. Update database connection in `config/config.ts`

4. Run the server:
```bash
npm run dev
```

## API Endpoints

All endpoints are prefixed with `/vava`

### Authentication
- POST `/register.php` - Register new user
- POST `/email/vava.php` - Send verification email
- POST `/verify.php` - Verify OTP
- POST `/irene.php` - Login
- GET `/irene.php?userid={id}` - Get user data

### Profile
- POST `/profile.php` - Update profile
- POST `/profilep.php` - Update profile picture
- POST `/uploadMany.php` - Upload multiple images

### Swiping/Matching
- POST `/love.php` - Get potential matches
- POST `/request.php` - Swipe action (like/pass)
- GET `/confirms.php?matchess={id}` - Get matches
- GET `/confirms.php?alllist={id}` - Get all likes

### Messaging
- POST `/sendmess.php` - Send message
- POST `/sendmessageimage.php` - Send image message
- POST `/getm.php` - Get messages
- POST `/messages.php` - Get chat list

### Notifications
- GET `/notification.php?user={id}` - Get notifications
- POST `/savetoken.php` - Save push notification token

## Database Models

- User
- Match
- Message
- Notification
- PushToken

