import { Router } from 'express';
import { API_HEALTH_PATH } from '@easyfinance/shared';
import { getHealth } from '../controllers/health.js';
export const healthRouter = Router();
healthRouter.get(API_HEALTH_PATH, getHealth);
