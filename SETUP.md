# MeIntoYou Backend Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database (Supabase recommended)
- npm or yarn

## Installation Steps

1. **Navigate to server directory:**
```bash
cd server
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure Database:**
   - Open `config/config.ts`
   - Update the Supabase connection string with your credentials
   - Or configure for local PostgreSQL

4. **Configure Email (Optional but recommended):**
   - Set up environment variables for email:
     - EMAIL_HOST (e.g., smtp.gmail.com)
     - EMAIL_USER (your email)
     - EMAIL_PASS (your app password)
   - Or modify `utils/email.ts` with your SMTP settings

5. **Start the server:**
```bash
npm run dev
```

The server will run on port 4001 by default.

## API Base URL
All endpoints are prefixed with `/vava`

Example: `http://localhost:4001/vava/register.php`

## Important Notes

1. **Database Sync**: The server will automatically create tables on first run
2. **File Uploads**: Images are stored in `server/uploads/` directory
3. **Push Notifications**: Configure Expo push notifications in `utils/pushNotification.ts`
4. **CORS**: Currently allows all origins. Configure in `app.ts` for production

## Testing Endpoints

Use Postman or similar tool to test:
- POST `/vava/register.php` - Register user
- POST `/vava/irene.php` - Login
- POST `/vava/love.php` - Get swipe cards
- POST `/vava/request.php` - Swipe action

## Troubleshooting

1. **Database Connection Error**: Check your connection string in `config/config.ts`
2. **Port Already in Use**: Change PORT in `server.ts` or set environment variable
3. **Module Not Found**: Run `npm install` again
4. **TypeScript Errors**: Ensure all dependencies are installed

