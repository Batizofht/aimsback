import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Express } from 'express';
import UserRoute from './routes/UserRoute';
import tokenRoute from './routes/tokenRoute';
import apiRoute from './routes/apiRoute';
import path from 'path';
import { touchLastActive } from './middlewares/touchLastActive';

let app: Express = express();
app.use(cors());

/* ================================ HERE ARE ALL THE ROUTES FORWARDING CENTER AND ALSO CONTROLLING AUTHORIZATION IN FUTUTRE ============== */
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

app.use(touchLastActive);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Token generation endpoint for Agora
app.use("/vava", tokenRoute);

app.use("/vava", UserRoute);

// New clean API routes
app.use("/api", apiRoute);

app.get('/', (req, res) => {
  res.send('MeIntoYou API Server');
});

export default app;

