import bodyParser from 'body-parser';
import cors from 'cors';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import express, { Express } from 'express';
import path from 'path';
import fs from 'fs';

let app: Express = express();
app.use(cors());

app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000mb' }));

// Serve static files from uploads directory
const uploadsPath = path.join(process.cwd(), 'uploads');
const blogCoversPath = path.join(uploadsPath, 'blog-covers');
const documentsPath = path.join(uploadsPath, 'documents');

// Ensure upload directories exist so static serving works even if no files have been uploaded yet
[uploadsPath, blogCoversPath, documentsPath].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// On-the-fly image optimizer (resize + WebP, cached) — must run BEFORE static.
// Handles /uploads/**?w=… requests; everything else falls through to static.
import imageResize from './middlewares/imageResize';
app.use('/uploads', imageResize);
app.use('/uploads', express.static(uploadsPath));

// API routes
import AuthRoute from './routes/AuthRoute';
import AdminRoute from './routes/AdminRoute';
import BlogPostRoute from './routes/BlogPostRoute';
import AppointmentRoute from './routes/AppointmentRoute';
import MessageRoute from './routes/MessageRoute';
import MemberRoute from './routes/MemberRoute';
import ServiceRequestRoute from './routes/ServiceRequestRoute';
import ContactRoute from './routes/ContactRoute';
import ConsultationRoute from './routes/ConsultationRoute';
import UploadRoute from './routes/UploadRoute';
import ChatRoute from './routes/ChatRoute';

app.use("/api", AuthRoute);
app.use("/api/admins", AdminRoute);
app.use("/api/posts", BlogPostRoute);
app.use("/api/appointments", AppointmentRoute);
app.use("/api/messages", MessageRoute);
app.use("/api/members", MemberRoute);
app.use("/api/service-requests", ServiceRequestRoute);
app.use("/api/contact", ContactRoute);
app.use("/api/consultations", ConsultationRoute);
app.use("/api/upload", UploadRoute);
app.use("/api/chat", ChatRoute);

app.get('/', (req, res) => {
  res.send('AIMS Capital API Server');
});

export default app;

