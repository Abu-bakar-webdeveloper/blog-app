import express from 'express';
import cors from 'cors';
import { NODE_ENV } from './src/config/index.js';
import dotenv from 'dotenv';
import uploadRoutes from './src/routes/upload.routes.js'; 




// Import routes
import authRoutes from './src/routes/auth.routes.js';
import blogRoutes from './src/routes/blog.routes.js';
import userRoutes from './src/routes/user.routes.js';
import reportRoutes from './src/routes/report.routes.js';

const app = express();
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes); 
app.use('/api/blogs', blogRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

export default app;