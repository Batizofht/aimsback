# Backend Endpoints Checklist

## ✅ All Endpoints Match Frontend

### Authentication
- ✅ POST `/vava/register.php` - Returns number (userId)
- ✅ POST `/vava/email/vava.php` - Returns number (userId)
- ✅ POST `/vava/email/vava(1).php` - Returns number (userId) if found, 0 if not
- ✅ POST `/vava/verify.php` - Returns number (userId) if valid, 0 if invalid
- ✅ POST `/vava/irene.php` - Returns number (userId) if login successful
- ✅ GET `/vava/irene.php?userid={id}` - Returns user object
- ✅ POST `/vava/irene2.php` - Returns number (userId) after registration completion

### Profile
- ✅ POST `/vava/profile.php` - Updates profile
- ✅ POST `/vava/profilep.php` - Updates profile picture
- ✅ POST `/vava/uploadMany.php` - Returns number (userId) after upload
- ✅ GET `/vava/show.php?post={id}` - Returns user profile
- ✅ POST `/vava/show.php` with `changingpassword` - Returns {status: 0 or 1}
- ✅ POST `/vava/show.php` with `restorepass` - Returns number (userId) if successful, string if error

### Preferences/Settings
- ✅ POST `/vava/verifys.php` with `updatelocation` - Updates location
- ✅ POST `/vava/verifys.php` with `lookes` - Updates gender preference
- ✅ POST `/vava/verifys.php` with `Orientation` - Updates orientation
- ✅ POST `/vava/verifys.php` with `looking` and `for` - Updates relationship preferences
- ✅ POST `/vava/verifys.php` with `date`, `month`, `year` - Updates birth date
- ✅ GET `/vava/more2.php` - Updates age range (from)
- ✅ GET `/vava/more.php` - Updates age range (to)
- ✅ GET `/vava/more3.php` - Updates distance/global/toppicks/email/push settings

### Swiping/Matching
- ✅ POST `/vava/love.php` - Returns array of potential matches
- ✅ GET `/vava/Allhome.php` - Returns array of potential matches (query params)
- ✅ POST `/vava/request.php` - Records swipe action
- ✅ GET `/vava/confirms.php?matchess={id}` - Returns array of matches
- ✅ GET `/vava/confirms.php?alllist={id}` - Returns array of users who liked
- ✅ POST `/vava/irenefetch.php` - Returns array of top picks

### Messaging
- ✅ POST `/vava/sendmess.php` - Sends text message
- ✅ POST `/vava/sendmessageimage.php` - Sends image message
- ✅ POST `/vava/getm.php` - Returns array of messages
- ✅ POST `/vava/messages.php` - Returns array of chat users
- ✅ GET `/vava/irene.php?deletemessage={id}` - Deletes message
- ✅ GET `/vava/irene.php?setStatusssss={id}` - Returns "Active" or "Offline"

### Notifications
- ✅ GET `/vava/notification.php?user={id}` - Returns array of notifications
- ✅ GET `/vava/irene.php?notification={id}` - Returns array (for count)
- ✅ GET `/vava/irene.php?deletenotification={id}` - Deletes all notifications
- ✅ GET `/vava/irene.php?deletestattus={id}` - Marks notifications as read
- ✅ POST `/vava/savetoken.php` - Saves push notification token
- ✅ GET `/vava/nubook.php?userId={id}` - Marks notifications as read

### Account Management
- ✅ GET `/vava/irene.php?deleteAccount={id}` - Deletes account

### File Serving
- ✅ GET `/vava/filesp/:file` - Serves uploaded files

## Response Format Notes

1. **Number responses**: Register, login, verify, upload images return just the userId number
2. **Status responses**: Change password returns {status: 0 or 1}
3. **Array responses**: Matches, messages, notifications return arrays
4. **Object responses**: User data returns full user object
5. **String responses**: Error messages return strings, success returns numbers

## All endpoints are now compatible with the frontend! 🎉

