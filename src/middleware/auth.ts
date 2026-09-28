import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateProfile, isAuthorizedAdmin } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  profile?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format.' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Attach profile and resolve server-side verified role
    const profile = await getOrCreateProfile(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name || ''
    );
    req.profile = profile;

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.user = decodedToken;
        const profile = await getOrCreateProfile(
          decodedToken.uid,
          decodedToken.email || '',
          decodedToken.name || ''
        );
        req.profile = profile;
      } catch (e) {
        // Silently continue for optional auth
      }
    }
  }
  next();
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.profile) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const email = (req.user.email || '').trim().toLowerCase();
  const isAdmin = req.profile.role === 'admin' || (await isAuthorizedAdmin(email));

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Access denied. You do not have municipal administrator privileges.',
    });
  }

  next();
};

export const requireWorkerOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.profile) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const role = req.profile.role;
  const email = (req.user.email || '').trim().toLowerCase();
  const isAdmin = role === 'admin' || (await isAuthorizedAdmin(email));

  if (!isAdmin && role !== 'worker' && role !== 'supervisor') {
    return res.status(403).json({
      error: 'Access denied. Field worker or administrator privileges required.',
    });
  }

  next();
};
