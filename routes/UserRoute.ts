import { Router } from "express";
import express from "express";
import {
  registerUser,
  sendVerificationEmail,
  verifyOTP,
  resendOTP,
  loginUser,
  googleAuth,
  getUserData,
  forgotPassword,
  updateUsername,
  changePassword,
  deleteAccount,
  updateSubscriptionStatus,
  updateManualLocationStatus,
} from "../controllers/AuthController";
import {
  updateProfile,
  updateProfilePicture,
  uploadMultipleImages,
  getUserProfile,
  updateLocation,
  updateSettings,
  updatePreferences,
} from "../controllers/ProfileController";
import {
  getPotentialMatches,
  swipeAction,
  getMatches,
  getAllLikes,
  getTopPicks,
  filteredExplore,
  resetNewLikes,
} from "../controllers/SwipeController";
import {
  sendMessage,
  sendMessageImage,
  sendAudio,
  getMessages,
  getChatList,
  deleteMessage,
  getUserStatus,
  resetNewMessage,
} from "../controllers/MessageController";
import { setStatus } from "../controllers/StatusController";
import {
  getNotifications,
  getNotificationCount,
  deleteAllNotifications,
  deleteNotificationById,
  deleteNotificationStatus,
  savePushToken,
} from "../controllers/NotificationController";
import { retrieveFile } from "../controllers/FileController";
import { markNotificationsRead } from "../controllers/HomeController";
import { submitReport, getReports, getReportsForUser } from "../controllers/ReportController";
import { getContactMessages, submitContactMessage, deleteContactMessages } from '../controllers/ContactController';
import {
  adminDeleteUser,
  adminListUsers,
  adminLogin,
  adminReportsSummary,
  adminSetUserBlocked,
  adminStats,
  adminUserGrowth,
  adminWarnReportedUser,
  adminBlockReportedUser,
} from "../controllers/AdminController";
import {
  adminAutosaveBlog,
  adminCreateBlog,
  adminDeleteBlog,
  adminGetBlog,
  adminListBlogs,
  adminUploadBlogCover,
  adminUpdateBlog,
  getPublicBlogBySlug,
  incrementBlogView,
  listPublicBlogs,
} from "../controllers/BlogController";
import { acceptCall, endCall, getActiveCallBetweenUsers, getCallHistory, startCall, generateAgoraToken } from "../controllers/CallController";
import upload from "../middlewares/upload";
import { requireAdmin } from "../middlewares/adminAuth";
import blogCoverUpload from "../middlewares/blogCoverUpload";
import {
  adminListVerification,
  adminReviewVerification,
  getMyVerificationStatus,
  submitVerification,
} from "../controllers/VerificationController";

const UserRoute = Router();


// Authentication routes
UserRoute.post("/register.php", upload.none(), registerUser);
UserRoute.post("/email/vava.php", upload.none(), sendVerificationEmail);
UserRoute.post("/email/vava(1).php", upload.none(), forgotPassword);
// Alias route (more URL-safe than parentheses)
UserRoute.post("/email/vava1.php", upload.none(), forgotPassword);
UserRoute.post("/verify.php", upload.none(), verifyOTP);
UserRoute.post("/resend-otp", upload.none() , resendOTP);
UserRoute.post("/irene.php", upload.none(), loginUser);
UserRoute.post("/google-auth", upload.none(), googleAuth);
UserRoute.post("/irene2.php", upload.none(), updateUsername);
// show.php handles both POST (change password/reset password) and GET (get profile)
UserRoute.post("/show.php", upload.none(), changePassword);
UserRoute.get("/show.php", getUserProfile);
UserRoute.get("/irene.php", (req, res) => {
  // Handle multiple GET endpoints for irene.php
  if (req.query.userid) {
    getUserData(req, res);
  } else if (req.query.notification) {
    getNotificationCount(req, res);
  } else if (req.query.deletestattus) {
    deleteNotificationStatus(req, res);
  } else if (req.query.deleteAccount) {
    deleteAccount(req, res);
  } else if (req.query.deletemessage) {
    deleteMessage(req, res);
  } else if (req.query.deletenotification) {
    deleteAllNotifications(req, res);
  } else if (req.query.deletenotificationid) {
    deleteNotificationById(req, res);
  } else if (req.query.status) {
    // set user status to online/offline
    setStatus(req, res);
  } else if (req.query.setStatusssss) {
    getUserStatus(req, res);
  } else {
    res.status(400).json({ message: "Invalid query parameter", status: 0 });
  }
});


// Profile routes
UserRoute.post("/profile.php", upload.none(), updateProfile);
UserRoute.post("/profilep.php", upload.none(), updateProfilePicture);
UserRoute.post("/uploadMany.php", uploadMultipleImages);
UserRoute.post("/gender.php", upload.none(), updatePreferences);
UserRoute.post("/verifys.php", upload.none(), (req, res) => {
  // Handle multiple POST endpoints for verifys.php
  if (req.body.updatelocation) {
    updateLocation(req, res);
  } else if (req.body.lookes || req.body.Orientation || req.body.looking || req.body.date || req.body.interest || req.body.fors || req.body.gender) {
    updatePreferences(req, res);
  } else {
    res.status(400).json(0);
  }
});
UserRoute.get("/more2.php",upload.none(), updateSettings);
UserRoute.get("/more.php",upload.none(), updateSettings);
UserRoute.get("/more3.php",upload.none(), updateSettings);

// Swiping/Matching routes
UserRoute.post("/love.php", upload.none(), getPotentialMatches);
UserRoute.get("/Allhome.php",upload.none(), getPotentialMatches);
UserRoute.post("/request.php", upload.none(), swipeAction);
UserRoute.get("/confirms.php", (req, res) => {
  if (req.query.matchess) {
    getMatches(req, res);
  } else if (req.query.alllist) {
    getAllLikes(req, res);
  } else {
    res.status(400).json({ message: "Invalid query parameter", status: 0 });
  }
});
UserRoute.post("/irenefetch.php", upload.none(), getTopPicks);
UserRoute.post("/filteredExplore.php", upload.none(), filteredExplore);
UserRoute.post("/resetnewlikes.php", upload.none(), resetNewLikes);

// Messaging routes
UserRoute.post("/sendmess.php", upload.none(), sendMessage);
UserRoute.post("/sendmessageimage.php", upload.none(), sendMessageImage);
UserRoute.post("/sendaudio.php", upload.single('audio'), sendAudio);
UserRoute.post("/getm.php", upload.none(), getMessages);
UserRoute.post("/messages.php", upload.none(), getChatList);
UserRoute.post("/resetnewmessage.php", upload.none(), resetNewMessage);

// Notification routes
UserRoute.get("/notification.php",upload.none(), getNotifications);
UserRoute.post("/savetoken.php",upload.none(), savePushToken);
UserRoute.get("/nubook.php",upload.none(), markNotificationsRead);

// Report routes
UserRoute.post("/submitreport.php", upload.none(), submitReport);
UserRoute.get("/getreports.php", upload.none(), getReports);
UserRoute.get("/userreports.php", upload.none(), getReportsForUser);

// Contact routes
UserRoute.post("/contact.php", upload.none(), submitContactMessage);

// Admin auth
UserRoute.post("/admin/login", upload.none(), adminLogin);

// Admin (protected)
UserRoute.get("/admin/stats", requireAdmin, adminStats);
UserRoute.get("/admin/users", requireAdmin, adminListUsers);
UserRoute.patch("/admin/users/:id/block", requireAdmin, adminSetUserBlocked);
UserRoute.delete("/admin/users/:id", requireAdmin, adminDeleteUser);
UserRoute.get("/admin/reports/summary", requireAdmin, adminReportsSummary);
UserRoute.post("/admin/reports/:id/warn", requireAdmin, upload.none(), adminWarnReportedUser);
UserRoute.post("/admin/reports/:id/block", requireAdmin, upload.none(), adminBlockReportedUser);
UserRoute.get("/admin/user-growth", requireAdmin, adminUserGrowth);
UserRoute.get("/admin/contacts", requireAdmin, getContactMessages);
UserRoute.post("/admin/contacts/delete", requireAdmin, upload.none(), deleteContactMessages);
UserRoute.get("/admin/blogs", requireAdmin, adminListBlogs);
UserRoute.get("/admin/blogs/:id", requireAdmin, adminGetBlog);
UserRoute.post("/admin/blogs", requireAdmin, upload.none(), adminCreateBlog);
UserRoute.put("/admin/blogs/:id", requireAdmin, upload.none(), adminUpdateBlog);
UserRoute.patch("/admin/blogs/:id/autosave", requireAdmin, upload.none(), adminAutosaveBlog);
UserRoute.post("/admin/blogs/upload-cover", requireAdmin, blogCoverUpload.single('coverImage'), adminUploadBlogCover);
UserRoute.delete("/admin/blogs/:id", requireAdmin, adminDeleteBlog);

// Public blogs
UserRoute.get("/blogs", listPublicBlogs);
UserRoute.get("/blogs/:slug", getPublicBlogBySlug);
UserRoute.post("/blogs/:slug/view", upload.none(), incrementBlogView);

// Calls + call history
UserRoute.post("/calls/start", upload.none(), startCall);
UserRoute.post("/calls/accept", upload.none(), acceptCall);
UserRoute.post("/calls/end", upload.none(), endCall);
UserRoute.post("/calls/generate-token", upload.none(), generateAgoraToken);
UserRoute.get("/calls/active", getActiveCallBetweenUsers);
UserRoute.get("/calls/history", getCallHistory);

// Subscription and premium features
UserRoute.post("/api/update-subscription", upload.none(), updateSubscriptionStatus);
UserRoute.post("/api/manual-location-status", upload.none(), updateManualLocationStatus);

// Verification (user)
UserRoute.post(
  "/verification/submit",
  upload.fields([
    { name: 'verificationDocFront', maxCount: 1 },
    { name: 'verificationDocBack', maxCount: 1 },
    { name: 'verificationVideo', maxCount: 1 },
  ]),
  submitVerification
);
UserRoute.get("/verification/status", getMyVerificationStatus);

// Verification (admin)
UserRoute.get("/admin/verification", requireAdmin, adminListVerification);
UserRoute.post("/admin/verification/:id/review", requireAdmin, upload.none(), adminReviewVerification);

// File retrieval
// Serve message images
UserRoute.get("/messageimage/:file", (req, res) => {
  req.query.folder = "messageimage";
  retrieveFile(req, res);
});
// Serve slider images (matches frontend expectation)
UserRoute.get("/slider/:file", (req, res) => {
  req.query.folder = "slider";
  retrieveFile(req, res);
});
// Serve Images folder (profile pictures, etc.)
UserRoute.get("/Images/:file", (req, res) => {
  req.query.folder = "Images";
  retrieveFile(req, res);
});

// Serve audio files
UserRoute.get("/audio/:file", (req, res) => {
  req.query.folder = "audio";
  retrieveFile(req, res);
});

// Serve verification uploads
UserRoute.get("/verification/:file", (req, res) => {
  req.query.folder = "verification";
  retrieveFile(req, res);
});

export default UserRoute;

