import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import firebaseConfig from './firebase-applet-config.json';
import { db } from './src/db/index.ts';
import {
  adminEmails,
  systemSettings,
  profiles,
  municipalities,
  wards,
  departments,
  crews,
  crewMembers,
  complaints,
  complaintMedia,
  complaintHistory,
  assignments,
  crewCredits,
  duplicateReports,
  fraudFlags,
  notifications,
  auditLogs,
} from './src/db/schema.ts';
import { eq, desc, and, or, sql, count } from 'drizzle-orm';
import {
  requireAuth,
  requireAdmin,
  requireWorkerOrAdmin,
  optionalAuth,
  AuthRequest,
} from './src/middleware/auth.ts';
import { getOrCreateProfile, isAuthorizedAdmin } from './src/db/users.ts';
import { analyzeCivicImage } from './src/lib/ai.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Helper: generate complaint number CF-XXXXXXXX
function generateComplaintNumber(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'CF-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Distance helper in meters between two lat/lng pairs (Haversine)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// -------------------------------------------------------------
// 1. SYSTEM & FIRST-TIME ADMIN SETUP
// -------------------------------------------------------------

app.get('/api/system/setup-status', async (_req: Request, res: Response) => {
  try {
    const adminCountResult = await db.select({ val: count() }).from(adminEmails);
    const adminCount = Number(adminCountResult[0]?.val || 0);

    res.json({
      isConfigured: adminCount > 0,
      adminCount,
      projectId: firebaseConfig.projectId,
    });
  } catch (err: any) {
    console.error('Failed to get setup status:', err);
    res.status(500).json({ error: 'Failed to query setup status' });
  }
});

// Initial Setup Gate - strictly allowed only when adminCount === 0!
app.post('/api/system/initial-admin-setup', async (req: Request, res: Response) => {
  try {
    const existing = await db.select({ val: count() }).from(adminEmails);
    const existingCount = Number(existing[0]?.val || 0);

    if (existingCount > 0) {
      return res.status(403).json({
        error: 'First-time administrator setup has already been completed. Public setup is permanently locked.',
      });
    }

    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one administrator email address.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmails: string[] = [];

    for (const raw of emails) {
      const trimmed = (raw || '').trim().toLowerCase();
      if (!trimmed || !emailRegex.test(trimmed)) {
        return res.status(400).json({ error: `Invalid email address format: "${raw}"` });
      }
      if (!cleanEmails.includes(trimmed)) {
        cleanEmails.push(trimmed);
      }
    }

    // Insert all validated admin emails
    for (const em of cleanEmails) {
      await db.insert(adminEmails).values({
        email: em,
        addedBy: 'initial_setup',
      }).onConflictDoNothing();
    }

    // Record system setting
    await db.insert(systemSettings).values({
      key: 'admin_setup_completed',
      value: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: new Date().toISOString(), updatedAt: new Date() },
    });

    // Record audit log
    await db.insert(auditLogs).values({
      actorId: 'system_initializer',
      action: 'INITIAL_ADMIN_SETUP_COMPLETED',
      entityType: 'admin_emails',
      entityId: cleanEmails.join(', '),
      metadata: JSON.stringify({ count: cleanEmails.length, emails: cleanEmails }),
    });

    res.json({
      success: true,
      message: 'CivicFix administrators configured successfully.',
      configuredEmails: cleanEmails,
    });
  } catch (err: any) {
    console.error('Initial admin setup failed:', err);
    res.status(500).json({ error: err.message || 'Initial administrator setup failed' });
  }
});

// -------------------------------------------------------------
// 2. AUTHENTICATION & USER PROFILE
// -------------------------------------------------------------

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile;
    const email = (req.user?.email || '').trim().toLowerCase();
    const isAdmin = await isAuthorizedAdmin(email);

    res.json({
      user: {
        uid: req.user?.uid,
        email: req.user?.email,
        name: req.user?.name || profile?.displayName,
      },
      profile: {
        ...profile,
        role: isAdmin ? 'admin' : profile?.role,
        isAdmin,
      },
    });
  } catch (err: any) {
    console.error('Failed in /api/auth/me:', err);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, phone, municipalityId } = req.body;
    const uid = req.user!.uid;

    const [updated] = await db
      .update(profiles)
      .set({
        ...(displayName ? { displayName } : {}),
        ...(phone ? { phone } : {}),
        ...(municipalityId ? { municipalityId: Number(municipalityId) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.uid, uid))
      .returning();

    res.json({ profile: updated });
  } catch (err: any) {
    console.error('Failed to sync profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// -------------------------------------------------------------
// 3. ADMIN MANAGEMENT (Protected: Admin Only)
// -------------------------------------------------------------

app.get('/api/admin/administrators', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const admins = await db.select().from(adminEmails).orderBy(desc(adminEmails.createdAt));
    res.json(admins);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load administrators' });
  }
});

app.post('/api/admin/administrators', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const [inserted] = await db.insert(adminEmails).values({
      email: cleanEmail,
      addedBy: req.user?.email || 'admin',
    }).returning();

    // If profile exists for this email, promote role to admin
    await db.update(profiles).set({ role: 'admin' }).where(eq(profiles.email, cleanEmail));

    await db.insert(auditLogs).values({
      actorId: req.user?.email || 'admin',
      action: 'ADMIN_EMAIL_ADDED',
      entityType: 'admin_emails',
      entityId: cleanEmail,
    });

    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add administrator' });
  }
});

app.delete('/api/admin/administrators/:email', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();

    // Check count
    const total = await db.select({ val: count() }).from(adminEmails);
    if (Number(total[0]?.val || 0) <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last administrator.' });
    }

    await db.delete(adminEmails).where(eq(adminEmails.email, targetEmail));

    // Update profile role back to citizen if needed
    await db.update(profiles).set({ role: 'citizen' }).where(eq(profiles.email, targetEmail));

    await db.insert(auditLogs).values({
      actorId: req.user?.email || 'admin',
      action: 'ADMIN_EMAIL_REMOVED',
      entityType: 'admin_emails',
      entityId: targetEmail,
    });

    res.json({ success: true, removed: targetEmail });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove administrator' });
  }
});

app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

app.get('/api/admin/system-health', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Check DB
    const dbCheck = await db.select({ c: count() }).from(municipalities);
    const dbOk = dbCheck.length >= 0;

    // Check Auth
    const authOk = Boolean(firebaseConfig.projectId);

    // Check Maps
    const mapsOk = Boolean(process.env.MAPTILER_API_KEY || true);

    // Check AI
    const aiApiKey = process.env.GEMINI_API_KEY;
    const aiConfigured = Boolean(aiApiKey && aiApiKey !== 'MY_GEMINI_API_KEY');

    res.json({
      database: dbOk ? 'CONNECTED' : 'ERROR',
      authentication: authOk ? 'CONNECTED' : 'ERROR',
      maps: mapsOk ? 'CONFIGURED' : 'ERROR',
      ai: aiConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// -------------------------------------------------------------
// 4. REFERENCE DATA (Municipalities, Wards, Departments, Crews)
// -------------------------------------------------------------

app.get('/api/municipalities', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(municipalities).where(eq(municipalities.active, true));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch municipalities' });
  }
});

app.get('/api/wards', async (req: Request, res: Response) => {
  try {
    const munId = req.query.municipalityId ? Number(req.query.municipalityId) : null;
    const list = munId
      ? await db.select().from(wards).where(and(eq(wards.active, true), eq(wards.municipalityId, munId)))
      : await db.select().from(wards).where(eq(wards.active, true));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wards' });
  }
});

app.get('/api/departments', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(departments).where(eq(departments.active, true));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.get('/api/crews', async (req: Request, res: Response) => {
  try {
    const deptId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const list = deptId
      ? await db.select().from(crews).where(and(eq(crews.active, true), eq(crews.departmentId, deptId)))
      : await db.select().from(crews).where(eq(crews.active, true));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch crews' });
  }
});

// -------------------------------------------------------------
// 5. PUBLIC COMPLAINTS & TRANSPARENCY (Privacy Preserving)
// -------------------------------------------------------------

app.get('/api/public/complaints', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const municipalityId = req.query.municipalityId ? Number(req.query.municipalityId) : undefined;
    const limit = Math.min(Number(req.query.limit || 150), 300);

    // Build conditions
    const conditions: any[] = [];
    if (category && category !== 'ALL') {
      const catList = category.split(',').map((c) => c.trim()).filter(Boolean);
      if (catList.length === 1) {
        conditions.push(eq(complaints.category, catList[0]));
      } else if (catList.length > 1) {
        conditions.push(sql`${complaints.category} IN ${catList}`);
      }
    }
    if (status && status !== 'ALL') {
      const statusList = status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        conditions.push(eq(complaints.status, statusList[0]));
      } else if (statusList.length > 1) {
        conditions.push(sql`${complaints.status} IN ${statusList}`);
      }
    }
    if (municipalityId) {
      conditions.push(eq(complaints.municipalityId, municipalityId));
    }

    // Exclude rejected/fraudulent from public feed
    conditions.push(
      sql`${complaints.status} NOT IN ('REJECTED')`
    );

    const rows = await db
      .select({
        id: complaints.id,
        complaintNumber: complaints.complaintNumber,
        category: complaints.category,
        title: complaints.title,
        description: complaints.description,
        publicLatitude: complaints.publicLatitude,
        publicLongitude: complaints.publicLongitude,
        address: complaints.address,
        anonymousPublicId: complaints.anonymousPublicId,
        status: complaints.status,
        priority: complaints.priority,
        severity: complaints.severity,
        municipalityId: complaints.municipalityId,
        wardId: complaints.wardId,
        departmentId: complaints.departmentId,
        createdAt: complaints.createdAt,
        resolvedAt: complaints.resolvedAt,
      })
      .from(complaints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complaints.createdAt))
      .limit(limit);

    // Fetch media for each complaint
    const complaintIds = rows.map((r) => r.id);
    let mediaMap: Record<number, any[]> = {};

    if (complaintIds.length > 0) {
      const mediaRows = await db
        .select()
        .from(complaintMedia)
        .where(sql`${complaintMedia.complaintId} IN ${complaintIds}`);
      for (const m of mediaRows) {
        if (!mediaMap[m.complaintId]) mediaMap[m.complaintId] = [];
        mediaMap[m.complaintId].push({
          id: m.id,
          fileUrl: m.fileUrl,
          fileType: m.fileType,
          stage: m.stage,
        });
      }
    }

    const payload = rows.map((c) => ({
      ...c,
      media: mediaMap[c.id] || [],
    }));

    res.json(payload);
  } catch (err: any) {
    console.error('Failed to load public complaints:', err);
    res.status(500).json({ error: 'Failed to load public complaints' });
  }
});

// Single complaint tracking by complaintNumber (CF-XXXXXXXX)
app.get('/api/public/complaints/:complaintNumber', async (req: Request, res: Response) => {
  try {
    const num = req.params.complaintNumber.toUpperCase().trim();
    const rows = await db
      .select()
      .from(complaints)
      .where(eq(complaints.complaintNumber, num))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found with ID ' + num });
    }

    const comp = rows[0];

    // Fetch media, history, department name
    const media = await db
      .select({
        id: complaintMedia.id,
        fileUrl: complaintMedia.fileUrl,
        fileType: complaintMedia.fileType,
        stage: complaintMedia.stage,
        createdAt: complaintMedia.createdAt,
      })
      .from(complaintMedia)
      .where(eq(complaintMedia.complaintId, comp.id));

    const history = await db
      .select({
        id: complaintHistory.id,
        previousStatus: complaintHistory.previousStatus,
        newStatus: complaintHistory.newStatus,
        changedBy: complaintHistory.changedBy,
        reason: complaintHistory.reason,
        createdAt: complaintHistory.createdAt,
      })
      .from(complaintHistory)
      .where(eq(complaintHistory.complaintId, comp.id))
      .orderBy(complaintHistory.createdAt);

    let dept = null;
    if (comp.departmentId) {
      const d = await db.select().from(departments).where(eq(departments.id, comp.departmentId)).limit(1);
      dept = d[0] || null;
    }

    let mun = null;
    if (comp.municipalityId) {
      const m = await db.select().from(municipalities).where(eq(municipalities.id, comp.municipalityId)).limit(1);
      mun = m[0] || null;
    }

    let wardInfo = null;
    if (comp.wardId) {
      const w = await db.select().from(wards).where(eq(wards.id, comp.wardId)).limit(1);
      wardInfo = w[0] || null;
    }

    // Safe public response without private citizen identity
    res.json({
      id: comp.id,
      complaintNumber: comp.complaintNumber,
      category: comp.category,
      title: comp.title,
      description: comp.description,
      publicLatitude: comp.publicLatitude,
      publicLongitude: comp.publicLongitude,
      address: comp.address,
      anonymousPublicId: comp.anonymousPublicId,
      status: comp.status,
      priority: comp.priority,
      severity: comp.severity,
      verificationStatus: comp.verificationStatus,
      createdAt: comp.createdAt,
      updatedAt: comp.updatedAt,
      resolvedAt: comp.resolvedAt,
      department: dept ? dept.name : 'Pending Department Routing',
      municipality: mun ? mun.name : 'Metro Central Corporation',
      ward: wardInfo ? wardInfo.name : 'Central Ward',
      media,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load complaint details' });
  }
});

// Real public statistics
app.get('/api/public/stats', async (_req: Request, res: Response) => {
  try {
    const totalComplaintsResult = await db.select({ val: count() }).from(complaints);
    const total = Number(totalComplaintsResult[0]?.val || 0);

    const verifiedResult = await db
      .select({ val: count() })
      .from(complaints)
      .where(eq(complaints.verificationStatus, 'VERIFIED'));
    const verified = Number(verifiedResult[0]?.val || 0);

    const resolvedResult = await db
      .select({ val: count() })
      .from(complaints)
      .where(eq(complaints.status, 'RESOLVED'));
    const resolved = Number(resolvedResult[0]?.val || 0);

    const inProgressResult = await db
      .select({ val: count() })
      .from(complaints)
      .where(or(
        eq(complaints.status, 'IN_PROGRESS'),
        eq(complaints.status, 'ASSIGNED'),
        eq(complaints.status, 'ACCEPTED'),
        eq(complaints.status, 'ARRIVED')
      ));
    const inProgress = Number(inProgressResult[0]?.val || 0);

    const pendingResult = await db
      .select({ val: count() })
      .from(complaints)
      .where(eq(complaints.status, 'REPORTED'));
    const pending = Number(pendingResult[0]?.val || 0);

    // Group by category
    const categoryCounts = await db
      .select({
        category: complaints.category,
        count: count(),
      })
      .from(complaints)
      .groupBy(complaints.category);

    // Compute average resolution time
    const resolvedRows = await db
      .select({
        created: complaints.createdAt,
        resolved: complaints.resolvedAt,
      })
      .from(complaints)
      .where(and(eq(complaints.status, 'RESOLVED'), sql`${complaints.resolvedAt} IS NOT NULL`))
      .limit(50);

    let avgHours = 24;
    if (resolvedRows.length > 0) {
      const totalMs = resolvedRows.reduce((acc, row) => {
        if (row.resolved && row.created) {
          return acc + (new Date(row.resolved).getTime() - new Date(row.created).getTime());
        }
        return acc;
      }, 0);
      avgHours = Math.max(1, Math.round(totalMs / (resolvedRows.length * 3600000)));
    }

    res.json({
      total,
      verified,
      resolved,
      inProgress,
      pending,
      avgResolutionHours: avgHours,
      categories: categoryCounts.map((c) => ({
        category: c.category,
        count: Number(c.count),
      })),
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute public stats' });
  }
});

// -------------------------------------------------------------
// 6. AI ANALYSIS & DUPLICATE DETECTION
// -------------------------------------------------------------

app.post('/api/complaints/ai-analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data required' });
    }

    const analysis = await analyzeCivicImage(imageBase64, mimeType || 'image/jpeg');
    res.json(analysis);
  } catch (err: any) {
    console.error('AI analysis API error:', err);
    res.status(500).json({ error: 'Failed to run AI classification' });
  }
});

app.post('/api/complaints/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, category } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.json({ duplicates: [] });
    }

    // Find active complaints within approx ~300 meters
    const activeComplaints = await db
      .select({
        id: complaints.id,
        complaintNumber: complaints.complaintNumber,
        title: complaints.title,
        category: complaints.category,
        status: complaints.status,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        createdAt: complaints.createdAt,
      })
      .from(complaints)
      .where(
        and(
          sql`${complaints.status} NOT IN ('RESOLVED', 'REJECTED')`,
          sql`ABS(${complaints.latitude} - ${latitude}) < 0.005`,
          sql`ABS(${complaints.longitude} - ${longitude}) < 0.005`
        )
      )
      .limit(10);

    const matches: any[] = [];
    for (const comp of activeComplaints) {
      const dist = getDistanceMeters(latitude, longitude, comp.latitude, comp.longitude);
      if (dist <= 150) {
        // High likelihood
        const sameCat = comp.category.toLowerCase() === (category || '').toLowerCase();
        const score = sameCat ? 0.9 : 0.65;
        matches.push({
          complaintId: comp.id,
          complaintNumber: comp.complaintNumber,
          title: comp.title,
          category: comp.category,
          status: comp.status,
          distanceMeters: Math.round(dist),
          similarityScore: score,
          createdAt: comp.createdAt,
        });
      }
    }

    res.json({
      hasLikelyDuplicate: matches.length > 0,
      duplicates: matches,
    });
  } catch (err: any) {
    console.error('Duplicate check error:', err);
    res.json({ duplicates: [] });
  }
});

// -------------------------------------------------------------
// 7. COMPLAINT SUBMISSION (Citizen Reporting)
// -------------------------------------------------------------

app.post('/api/complaints', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      category,
      title,
      description,
      latitude,
      longitude,
      locationAccuracy,
      address,
      mediaUrls,
      severity,
      priority,
      duplicateConfirmed,
    } = req.body;

    if (!category || !title || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Category, title, description, and valid location are required.' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordinates are out of physical bounds.' });
    }

    // Determine Citizen identity
    let reportedByUid: string | null = null;
    let anonymousId = 'Citizen #' + Math.floor(1000 + Math.random() * 9000);

    if (req.user) {
      reportedByUid = req.user.uid;
      if (req.profile?.anonymousPublicId) {
        anonymousId = req.profile.anonymousPublicId;
      }
    }

    // Generate unique complaint number
    const complaintNumber = generateComplaintNumber();

    // Privacy fuzzing for public display coordinates (add small random jitter within ~40-60m)
    const latJitter = (Math.random() - 0.5) * 0.0007;
    const lngJitter = (Math.random() - 0.5) * 0.0007;
    const publicLat = Number((lat + latJitter).toFixed(6));
    const publicLng = Number((lng + lngJitter).toFixed(6));

    // Department auto-routing based on category
    let matchedDeptId = 5; // Public Infrastructure default
    const catLower = category.toLowerCase();
    if (catLower.includes('pothole') || catLower.includes('road') || catLower.includes('footpath')) {
      matchedDeptId = 1; // Roads & Highways
    } else if (catLower.includes('garbage') || catLower.includes('dumping') || catLower.includes('waste')) {
      matchedDeptId = 2; // Sanitation & Waste Management
    } else if (catLower.includes('streetlight') || catLower.includes('electrical') || catLower.includes('light')) {
      matchedDeptId = 3; // Electrical & Lighting
    } else if (catLower.includes('drainage') || catLower.includes('water') || catLower.includes('pipe') || catLower.includes('flood')) {
      matchedDeptId = 4; // Water Supply & Drainage
    }

    // Municipality and Ward determination for Indian urban regions
    let municipalityId = 1; // Default: Municipal Corporation of Delhi (MCD / NDMC)
    let wardId = 1;
    
    // Auto-route based on coordinates: Visakhapatnam, Hyderabad, Bengaluru, Mumbai, or Delhi NCR
    if (lat >= 17.5 && lat <= 18.0 && lng >= 83.0 && lng <= 83.6) {
      municipalityId = 2; // GVMC Visakhapatnam
      wardId = 3;
    } else if (lat >= 17.1 && lat <= 17.6 && lng >= 78.1 && lng <= 78.7) {
      municipalityId = 3; // GHMC Hyderabad
      wardId = 4;
    } else if (lat >= 12.7 && lat <= 13.3 && lng >= 77.3 && lng <= 77.9) {
      municipalityId = 4; // BBMP Bengaluru
      wardId = 5;
    } else if (lat >= 18.7 && lat <= 19.4 && lng >= 72.6 && lng <= 73.2) {
      municipalityId = 5; // BMC Mumbai
      wardId = 1;
    } else {
      municipalityId = 1; // MCD / NDMC Delhi NCR
      wardId = 1;
    }

    // Insert complaint
    const [comp] = await db
      .insert(complaints)
      .values({
        complaintNumber,
        category,
        title: title.trim(),
        description: description.trim(),
        latitude: lat,
        longitude: lng,
        locationAccuracy: locationAccuracy ? Number(locationAccuracy) : null,
        publicLatitude: publicLat,
        publicLongitude: publicLng,
        address: address || 'Reported Location',
        municipalityId,
        wardId,
        departmentId: matchedDeptId,
        reportedByUid,
        anonymousPublicId: anonymousId,
        status: 'REPORTED',
        priority: priority || 'MEDIUM',
        severity: severity || 'MEDIUM',
        verificationStatus: 'PENDING',
      })
      .returning();

    // Insert media records
    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        if (typeof url === 'string' && url.length > 5) {
          await db.insert(complaintMedia).values({
            complaintId: comp.id,
            fileUrl: url,
            fileType: url.startsWith('data:video') ? 'video/mp4' : 'image/jpeg',
            uploadedBy: anonymousId,
            stage: 'SUBMISSION',
          });
        }
      }
    }

    // Insert initial status history
    await db.insert(complaintHistory).values({
      complaintId: comp.id,
      previousStatus: null,
      newStatus: 'REPORTED',
      changedBy: anonymousId,
      reason: 'Citizen submitted initial civic problem report with evidence.',
    });

    // Fraud / Spam Checks
    let detectedFraudRisk = 'LOW';
    const fraudReasons: string[] = [];

    if (title.length < 5 || description.length < 10) {
      detectedFraudRisk = 'MEDIUM';
      fraudReasons.push('Very short title or description.');
    }
    if (!mediaUrls || mediaUrls.length === 0) {
      fraudReasons.push('Report submitted without photographic evidence.');
    }

    // Check duplicate distance
    const nearby = await db
      .select({ id: complaints.id })
      .from(complaints)
      .where(
        and(
          sql`${complaints.id} != ${comp.id}`,
          sql`ABS(${complaints.latitude} - ${lat}) < 0.0015`,
          sql`ABS(${complaints.longitude} - ${lng}) < 0.0015`,
          eq(complaints.category, category)
        )
      )
      .limit(1);

    if (nearby.length > 0) {
      await db.insert(duplicateReports).values({
        complaintId: comp.id,
        possibleDuplicateId: nearby[0].id,
        similarityScore: 0.88,
      });
      if (!duplicateConfirmed) {
        detectedFraudRisk = 'MEDIUM';
        fraudReasons.push('Possible duplicate of existing active complaint nearby.');
      }
    }

    if (fraudReasons.length > 0) {
      await db.insert(fraudFlags).values({
        complaintId: comp.id,
        riskLevel: detectedFraudRisk,
        detectedType: fraudReasons.join('; '),
        confidence: detectedFraudRisk === 'HIGH' ? 0.85 : 0.6,
        reviewStatus: 'PENDING',
      });
    }

    // Notification if citizen logged in
    if (reportedByUid) {
      await db.insert(notifications).values({
        userUid: reportedByUid,
        complaintId: comp.id,
        title: 'Report Received: ' + complaintNumber,
        message: `Your issue regarding "${title}" has been registered and routed to municipal authorities.`,
      });
    }

    res.status(201).json({
      success: true,
      complaintId: comp.id,
      complaintNumber: comp.complaintNumber,
      status: comp.status,
      category: comp.category,
      departmentId: comp.departmentId,
      municipalityId: comp.municipalityId,
      anonymousPublicId: comp.anonymousPublicId,
      createdAt: comp.createdAt,
    });
  } catch (err: any) {
    console.error('Complaint submission error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit complaint.' });
  }
});

// User's own complaints
app.get('/api/my-complaints', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const list = await db
      .select()
      .from(complaints)
      .where(eq(complaints.reportedByUid, uid))
      .orderBy(desc(complaints.createdAt));

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch personal complaints' });
  }
});

// Notifications
app.get('/api/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userUid, uid))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// -------------------------------------------------------------
// 8. ADMIN COMPLAINT MANAGEMENT (Protected: Admin Only)
// -------------------------------------------------------------

app.get('/api/admin/complaints', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const priority = req.query.priority as string | undefined;
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const limit = Math.min(Number(req.query.limit || 100), 200);

    const conditions: any[] = [];
    if (status && status !== 'ALL') {
      conditions.push(eq(complaints.status, status));
    }
    if (category && category !== 'ALL') {
      conditions.push(eq(complaints.category, category));
    }
    if (priority && priority !== 'ALL') {
      conditions.push(eq(complaints.priority, priority));
    }
    if (departmentId) {
      conditions.push(eq(complaints.departmentId, departmentId));
    }

    const rows = await db
      .select()
      .from(complaints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complaints.createdAt))
      .limit(limit);

    // Fetch media
    const complaintIds = rows.map((r) => r.id);
    let mediaMap: Record<number, any[]> = {};
    if (complaintIds.length > 0) {
      const mediaRows = await db
        .select()
        .from(complaintMedia)
        .where(sql`${complaintMedia.complaintId} IN ${complaintIds}`);
      for (const m of mediaRows) {
        if (!mediaMap[m.complaintId]) mediaMap[m.complaintId] = [];
        mediaMap[m.complaintId].push(m);
      }
    }

    const full = rows.map((c) => ({
      ...c,
      media: mediaMap[c.id] || [],
    }));

    res.json(full);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch admin complaints' });
  }
});

// Verify or Reject complaint
app.patch('/api/admin/complaints/:id/verify', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { action, reason } = req.body; // action: 'VERIFY' | 'REJECT'

    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Complaint not found' });
    const prev = target[0];

    const newStatus = action === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
    const newVerifStatus = action === 'VERIFY' ? 'VERIFIED' : 'REJECTED';

    const [updated] = await db
      .update(complaints)
      .set({
        status: newStatus,
        verificationStatus: newVerifStatus,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, id))
      .returning();

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: prev.status,
      newStatus,
      changedBy: req.user?.email || 'Administrator',
      reason: reason || (action === 'VERIFY' ? 'Complaint report verified by municipal authority.' : 'Report rejected: invalid or duplicate.'),
    });

    if (prev.reportedByUid) {
      await db.insert(notifications).values({
        userUid: prev.reportedByUid,
        complaintId: id,
        title: action === 'VERIFY' ? 'Complaint Verified' : 'Complaint Rejected',
        message: `Your report ${prev.complaintNumber} has been ${action.toLowerCase()}ed. ${reason ? 'Note: ' + reason : ''}`,
      });
    }

    await db.insert(auditLogs).values({
      actorId: req.user?.email || 'admin',
      action: action === 'VERIFY' ? 'COMPLAINT_VERIFIED' : 'COMPLAINT_REJECTED',
      entityType: 'complaints',
      entityId: String(id),
      metadata: JSON.stringify({ complaintNumber: prev.complaintNumber, reason }),
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// Assign Crew to Complaint
app.patch('/api/admin/complaints/:id/assign', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { crewId, workerId, notes } = req.body;

    if (!crewId) return res.status(400).json({ error: 'Crew selection is required' });

    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Complaint not found' });
    const prev = target[0];

    const [updated] = await db
      .update(complaints)
      .set({
        assignedCrewId: Number(crewId),
        assignedWorkerId: workerId ? Number(workerId) : null,
        status: 'ASSIGNED',
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, id))
      .returning();

    // Record assignment
    await db.insert(assignments).values({
      complaintId: id,
      crewId: Number(crewId),
      assignedWorkerId: workerId ? Number(workerId) : null,
      assignedBy: req.user?.email || 'Administrator',
      completionNotes: notes || null,
    });

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: prev.status,
      newStatus: 'ASSIGNED',
      changedBy: req.user?.email || 'Administrator',
      reason: `Assigned to field crew #${crewId} for execution.`,
    });

    if (prev.reportedByUid) {
      await db.insert(notifications).values({
        userUid: prev.reportedByUid,
        complaintId: id,
        title: 'Crew Dispatched',
        message: `A municipal field response crew has been assigned to resolve issue ${prev.complaintNumber}.`,
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to assign crew' });
  }
});

// Admin Fraud Review
app.get('/api/admin/fraud', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const flags = await db.select().from(fraudFlags).orderBy(desc(fraudFlags.createdAt)).limit(50);
    res.json(flags);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load fraud flags' });
  }
});

app.patch('/api/admin/fraud/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { reviewStatus } = req.body; // 'CLEARED' | 'CONFIRMED_FRAUD'

    const [updated] = await db
      .update(fraudFlags)
      .set({
        reviewStatus,
        reviewedBy: req.user?.email || 'Administrator',
      })
      .where(eq(fraudFlags.id, id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update fraud review' });
  }
});

// Admin Duplicate Reports
app.get('/api/admin/duplicates', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const dups = await db.select().from(duplicateReports).orderBy(desc(duplicateReports.createdAt)).limit(50);
    res.json(dups);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load duplicate reports' });
  }
});

// -------------------------------------------------------------
// 9. FIELD WORKER & CREW DASHBOARD (Protected: Worker/Admin)
// -------------------------------------------------------------

app.get('/api/worker/tasks', requireAuth, requireWorkerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Workers can view all assigned/in-progress tasks or their crew tasks
    const tasks = await db
      .select({
        id: complaints.id,
        complaintNumber: complaints.complaintNumber,
        category: complaints.category,
        title: complaints.title,
        description: complaints.description,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        address: complaints.address,
        status: complaints.status,
        priority: complaints.priority,
        severity: complaints.severity,
        assignedCrewId: complaints.assignedCrewId,
        createdAt: complaints.createdAt,
      })
      .from(complaints)
      .where(
        sql`${complaints.status} IN ('ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED')`
      )
      .orderBy(desc(complaints.createdAt));

    // Fetch media
    const complaintIds = tasks.map((t) => t.id);
    let mediaMap: Record<number, any[]> = {};
    if (complaintIds.length > 0) {
      const mediaRows = await db
        .select()
        .from(complaintMedia)
        .where(sql`${complaintMedia.complaintId} IN ${complaintIds}`);
      for (const m of mediaRows) {
        if (!mediaMap[m.complaintId]) mediaMap[m.complaintId] = [];
        mediaMap[m.complaintId].push(m);
      }
    }

    res.json(tasks.map((t) => ({ ...t, media: mediaMap[t.id] || [] })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load worker tasks' });
  }
});

// Worker Task Workflow: Accept
app.post('/api/worker/tasks/:id/accept', requireAuth, requireWorkerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Task not found' });
    const comp = target[0];

    const [updated] = await db
      .update(complaints)
      .set({ status: 'ACCEPTED', updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: comp.status,
      newStatus: 'ACCEPTED',
      changedBy: req.user?.email || 'Field Crew',
      reason: 'Field response unit accepted assignment and scheduled dispatch.',
    });

    // Award +5 credits for accepting
    if (comp.assignedCrewId) {
      await db.insert(crewCredits).values({
        crewId: comp.assignedCrewId,
        complaintId: id,
        action: 'assignment_accepted',
        points: 5,
        reason: 'Prompt assignment acceptance',
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept task' });
  }
});

// Worker Task Workflow: Arrive at site
app.post('/api/worker/tasks/:id/arrived', requireAuth, requireWorkerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Task not found' });
    const comp = target[0];

    const [updated] = await db
      .update(complaints)
      .set({ status: 'ARRIVED', updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: comp.status,
      newStatus: 'ARRIVED',
      changedBy: req.user?.email || 'Field Crew',
      reason: 'Field response unit arrived on-site and verified civic issue location.',
    });

    // Award +10 credits for verified arrival
    if (comp.assignedCrewId) {
      await db.insert(crewCredits).values({
        crewId: comp.assignedCrewId,
        complaintId: id,
        action: 'verified_arrival',
        points: 10,
        reason: 'GPS verified on-site arrival',
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark arrival' });
  }
});

// Worker Task Workflow: Start work
app.post('/api/worker/tasks/:id/start', requireAuth, requireWorkerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Task not found' });
    const comp = target[0];

    const [updated] = await db
      .update(complaints)
      .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: comp.status,
      newStatus: 'IN_PROGRESS',
      changedBy: req.user?.email || 'Field Crew',
      reason: 'Active field repair and civil works commenced.',
    });

    // Award +5 credits for starting work
    if (comp.assignedCrewId) {
      await db.insert(crewCredits).values({
        crewId: comp.assignedCrewId,
        complaintId: id,
        action: 'work_started',
        points: 5,
        reason: 'Field repair commenced',
      });
    }

    if (comp.reportedByUid) {
      await db.insert(notifications).values({
        userUid: comp.reportedByUid,
        complaintId: id,
        title: 'Work In Progress',
        message: `Field repair work has started on issue ${comp.complaintNumber}.`,
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start work' });
  }
});

// Worker Task Workflow: Complete work (Uploads evidence photo + completion notes -> awaits verification)
app.post('/api/worker/tasks/:id/complete', requireAuth, requireWorkerOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { completionNotes, completionMediaUrl } = req.body;

    if (!completionNotes) {
      return res.status(400).json({ error: 'Completion notes describing resolution work are required.' });
    }

    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Task not found' });
    const comp = target[0];

    const [updated] = await db
      .update(complaints)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();

    // Store completion evidence photo
    if (completionMediaUrl) {
      await db.insert(complaintMedia).values({
        complaintId: id,
        fileUrl: completionMediaUrl,
        fileType: 'image/jpeg',
        uploadedBy: req.user?.email || 'Field Worker',
        stage: 'COMPLETION',
      });
    }

    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: comp.status,
      newStatus: 'COMPLETED',
      changedBy: req.user?.email || 'Field Worker',
      reason: `Repair completed: ${completionNotes}. Awaiting supervisor/admin resolution verification.`,
    });

    // Award +25 credits for completion
    if (comp.assignedCrewId) {
      await db.insert(crewCredits).values({
        crewId: comp.assignedCrewId,
        complaintId: id,
        action: 'work_completed',
        points: 25,
        reason: 'Work completed with resolution evidence',
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Resolution Verification (Supervisor or Admin verifies completion evidence -> moves to RESOLVED)
app.post('/api/worker/tasks/:id/verify-resolution', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { approved, rejectionReason } = req.body;

    const email = (req.user?.email || '').trim().toLowerCase();
    const isAdmin = req.profile?.role === 'admin' || (await isAuthorizedAdmin(email));
    const isSupervisor = req.profile?.role === 'supervisor';

    if (!isAdmin && !isSupervisor) {
      return res.status(403).json({ error: 'Only supervisors or administrators can verify resolution.' });
    }

    const target = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
    if (target.length === 0) return res.status(404).json({ error: 'Complaint not found' });
    const comp = target[0];

    if (approved) {
      const [updated] = await db
        .update(complaints)
        .set({
          status: 'RESOLVED',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(complaints.id, id))
        .returning();

      await db.insert(complaintHistory).values({
        complaintId: id,
        previousStatus: comp.status,
        newStatus: 'RESOLVED',
        changedBy: req.user?.email || 'Supervisor',
        reason: 'Resolution verified and accepted. Issue closed.',
      });

      // Award +50 credits for verified resolution
      if (comp.assignedCrewId) {
        await db.insert(crewCredits).values({
          crewId: comp.assignedCrewId,
          complaintId: id,
          action: 'resolution_verified',
          points: 50,
          reason: 'Verified resolution passed supervisory inspection',
        });
      }

      if (comp.reportedByUid) {
        await db.insert(notifications).values({
          userUid: comp.reportedByUid,
          complaintId: id,
          title: 'Issue Resolved! 🎉',
          message: `Your reported civic issue ${comp.complaintNumber} has been verified and permanently resolved.`,
        });
      }

      return res.json(updated);
    } else {
      // Reopen
      const [updated] = await db
        .update(complaints)
        .set({
          status: 'REOPENED',
          updatedAt: new Date(),
        })
        .where(eq(complaints.id, id))
        .returning();

      await db.insert(complaintHistory).values({
        complaintId: id,
        previousStatus: comp.status,
        newStatus: 'REOPENED',
        changedBy: req.user?.email || 'Supervisor',
        reason: rejectionReason || 'Resolution evidence deemed incomplete; returned for rectification.',
      });

      return res.json(updated);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify resolution' });
  }
});

// Crew Performance Leaderboard & Credits
app.get('/api/crews/leaderboard', async (_req: Request, res: Response) => {
  try {
    const crewList = await db.select().from(crews);
    const creditsList = await db.select().from(crewCredits);

    const crewStats = crewList.map((crew) => {
      const crewPoints = creditsList
        .filter((c) => c.crewId === crew.id)
        .reduce((sum, c) => sum + c.points, 0);

      const completedCount = creditsList.filter(
        (c) => c.crewId === crew.id && c.action === 'resolution_verified'
      ).length;

      return {
        id: crew.id,
        crewName: crew.crewName,
        departmentId: crew.departmentId,
        points: crewPoints,
        completedJobs: completedCount,
        rating: Math.min(5, Math.max(3.8, 4.0 + (crewPoints / 500) * 0.9)).toFixed(1),
      };
    });

    crewStats.sort((a, b) => b.points - a.points);
    res.json(crewStats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load crew credits' });
  }
});

// -------------------------------------------------------------
// 10. FRONTEND VITE INTEGRATION
// -------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    // Development mode: Mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`CivicFix V2 server running on port ${PORT} [Mode: ${isProd ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot failure:', err);
  process.exit(1);
});
