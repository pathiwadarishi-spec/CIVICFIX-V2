import { db } from './index.ts';
import { profiles, adminEmails } from './schema.ts';
import { eq } from 'drizzle-orm';

function generateAnonymousId(uid: string): string {
  const hash = Math.abs(
    uid.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)
  ).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  return `Citizen #CF-${hash}`;
}

export async function isAuthorizedAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(adminEmails)
      .where(eq(adminEmails.email, cleanEmail))
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error('Error checking admin email:', err);
    return false;
  }
}

export async function getOrCreateProfile(
  uid: string,
  email: string,
  displayName?: string
) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const isAdmin = await isAuthorizedAdmin(cleanEmail);

  try {
    // Check existing
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      // Sync admin status if changed
      if (isAdmin && user.role !== 'admin') {
        const [updated] = await db
          .update(profiles)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(profiles.uid, uid))
          .returning();
        return updated;
      }
      return user;
    }

    // Insert new profile
    const anonymousId = generateAnonymousId(uid);
    const assignedRole = isAdmin ? 'admin' : 'citizen';

    const [inserted] = await db
      .insert(profiles)
      .values({
        uid,
        email: cleanEmail,
        displayName: displayName || (isAdmin ? 'Civic Administrator' : 'Citizen'),
        role: assignedRole,
        anonymousPublicId: anonymousId,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: cleanEmail,
          updatedAt: new Date(),
          ...(isAdmin ? { role: 'admin' } : {}),
        },
      })
      .returning();

    return inserted;
  } catch (error) {
    console.error('Failed to getOrCreateProfile:', error);
    throw new Error('Database operation failed for user profile', { cause: error });
  }
}

export async function getProfileByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, uid))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to getProfileByUid:', error);
    throw new Error('Database query failed for user profile', { cause: error });
  }
}
