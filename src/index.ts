import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { disconnect } from './lib/database.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import paymentRoutes from './routes/payments.js';
import subscriptionRoutes from './routes/subscriptions.js';
import userRoutes from './routes/users.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Webhook routes need raw body — mount before json parser
app.use('/api/v1/webhooks', webhookRoutes);

// Parse JSON for all other routes
app.use(express.json());

// Rate limiting
app.use(rateLimiter());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/users', userRoutes);

// Error handler (must be last)
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Server started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  server.close();
  await disconnect();
  process.exit(0);
});
