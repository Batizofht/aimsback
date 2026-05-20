import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Express } from 'express';
import UserRoute from './routes/UserRoute';
import tokenRoute from './routes/tokenRoute';
import apiRoute from './routes/apiRoute';
import validationRoute from './routes/validationRoute';
import path from 'path';
import fs from 'fs';
import { touchLastActive } from './middlewares/touchLastActive';
import { generateSitemap, generateRobotsTxt } from './controllers/SitemapController';

let app: Express = express();
app.use(cors());

/* ================================ HERE ARE ALL THE ROUTES FORWARDING CENTER AND ALSO CONTROLLING AUTHORIZATION IN FUTUTRE ============== */
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000mb' }));

app.use(touchLastActive);

// Serve static files from uploads directory (supports both server cwd and project root cwd)
const uploadsPaths = [
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), 'server', 'uploads'),
  path.join(__dirname, '../uploads'),
]

for (const uploadsPath of uploadsPaths) {
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }
}

// Token generation endpoint for Agora
app.use("/vava", tokenRoute);

app.use("/vava", UserRoute);

// New clean API routes
app.use("/api", apiRoute);

// Validation routes (email availability, etc.)
app.use("/api/validate", validationRoute);

// SEO routes - dynamic sitemap and robots.txt
app.get('/sitemap.xml', generateSitemap);
app.get('/robots.txt', generateRobotsTxt);

app.get('/', (req, res) => {
  res.send('MeIntoYou API Server Running |FROM LIGHT INC|');
});

export default app;

