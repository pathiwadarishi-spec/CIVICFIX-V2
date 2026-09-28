import { pgTable, serial, text, timestamp, boolean, doublePrecision, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Authorized Administrator Emails (Configured by Project Owner)
export const adminEmails = pgTable('admin_emails', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  addedBy: text('added_by').notNull().default('system_setup'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// System Configuration & Setup State
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User Profiles (linked to Firebase Auth UID)
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('citizen'), // 'citizen' | 'admin' | 'supervisor' | 'worker'
  anonymousPublicId: text('anonymous_public_id').notNull().unique(), // e.g. "Citizen #CF-491A"
  municipalityId: integer('municipality_id'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Municipalities / Corporations
export const municipalities = pgTable('municipalities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  district: text('district').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Municipal Wards
export const wards = pgTable('wards', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id).notNull(),
  name: text('name').notNull(),
  boundaryData: text('boundary_data'), // GeoJSON string if applicable
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Municipal Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  name: text('name').notNull(), // 'Roads', 'Sanitation', 'Electrical', 'Drainage', 'Water', 'Public Works'
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Field Response Crews
export const crews = pgTable('crews', {
  id: serial('id').primaryKey(),
  municipalityId: integer('municipality_id').references(() => municipalities.id).notNull(),
  departmentId: integer('department_id').references(() => departments.id).notNull(),
  crewName: text('crew_name').notNull(),
  supervisorId: integer('supervisor_id').references(() => profiles.id),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Crew Members (Workers)
export const crewMembers = pgTable('crew_members', {
  id: serial('id').primaryKey(),
  crewId: integer('crew_id').references(() => crews.id).notNull(),
  workerId: integer('worker_id').references(() => profiles.id).notNull(),
  active: boolean('active').default(true).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Civic Complaints
export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  complaintNumber: text('complaint_number').notNull().unique(), // e.g. "CF-27A81C4D"
  category: text('category').notNull(), // Pothole, Garbage, Road Damage, Streetlight, Drainage, Water Leakage, etc.
  title: text('title').notNull(),
  description: text('description').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  locationAccuracy: doublePrecision('location_accuracy'),
  publicLatitude: doublePrecision('public_latitude').notNull(),
  publicLongitude: doublePrecision('public_longitude').notNull(),
  address: text('address').notNull(),
  municipalityId: integer('municipality_id').references(() => municipalities.id),
  wardId: integer('ward_id').references(() => wards.id),
  departmentId: integer('department_id').references(() => departments.id),
  reportedByUid: text('reported_by_uid'), // Internal link to authenticated citizen (never exposed publicly)
  anonymousPublicId: text('anonymous_public_id').notNull(), // Public label: e.g. "Citizen #CF-8349"
  status: text('status').notNull().default('REPORTED'), // REPORTED, UNDER_REVIEW, VERIFIED, ASSIGNED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, VERIFICATION, RESOLVED, REJECTED, DUPLICATE, REOPENED
  priority: text('priority').notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, URGENT
  severity: text('severity').notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  verificationStatus: text('verification_status').notNull().default('PENDING'), // PENDING, VERIFIED, REJECTED
  duplicateGroupId: text('duplicate_group_id'),
  assignedCrewId: integer('assigned_crew_id').references(() => crews.id),
  assignedWorkerId: integer('assigned_worker_id').references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

// Complaint Photos & Media
export const complaintMedia = pgTable('complaint_media', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(),
  uploadedBy: text('uploaded_by'),
  stage: text('stage').default('SUBMISSION').notNull(), // 'SUBMISSION' | 'COMPLETION'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Complaint Status History & Audit Trail
export const complaintHistory = pgTable('complaint_history', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status').notNull(),
  changedBy: text('changed_by').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Crew Work Assignments
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  crewId: integer('crew_id').references(() => crews.id).notNull(),
  assignedWorkerId: integer('assigned_worker_id').references(() => profiles.id),
  assignedBy: text('assigned_by').notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  arrivedAt: timestamp('arrived_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  completionNotes: text('completion_notes'),
});

// Crew Performance Credits Ledger
export const crewCredits = pgTable('crew_credits', {
  id: serial('id').primaryKey(),
  crewId: integer('crew_id').references(() => crews.id).notNull(),
  workerId: integer('worker_id').references(() => profiles.id),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  action: text('action').notNull(), // 'assignment_accepted', 'verified_arrival', 'work_started', 'work_completed', 'resolution_verified', 'timely_completion'
  points: integer('points').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Duplicate Issue Reports
export const duplicateReports = pgTable('duplicate_reports', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  possibleDuplicateId: integer('possible_duplicate_id').references(() => complaints.id).notNull(),
  similarityScore: doublePrecision('similarity_score').notNull(),
  reviewed: boolean('reviewed').default(false).notNull(),
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Fraud & Spam Risk Flags
export const fraudFlags = pgTable('fraud_flags', {
  id: serial('id').primaryKey(),
  complaintId: integer('complaint_id').references(() => complaints.id).notNull(),
  riskLevel: text('risk_level').notNull(), // 'LOW' | 'MEDIUM' | 'HIGH'
  detectedType: text('detected_type').notNull(),
  confidence: doublePrecision('confidence').notNull(),
  reviewStatus: text('review_status').default('PENDING').notNull(), // 'PENDING' | 'CLEARED' | 'CONFIRMED_FRAUD'
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  complaintId: integer('complaint_id').references(() => complaints.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [complaints.municipalityId],
    references: [municipalities.id],
  }),
  ward: one(wards, {
    fields: [complaints.wardId],
    references: [wards.id],
  }),
  department: one(departments, {
    fields: [complaints.departmentId],
    references: [departments.id],
  }),
  assignedCrew: one(crews, {
    fields: [complaints.assignedCrewId],
    references: [crews.id],
  }),
  media: many(complaintMedia),
  history: many(complaintHistory),
  assignments: many(assignments),
  fraudFlags: many(fraudFlags),
  duplicateReports: many(duplicateReports),
}));

export const complaintMediaRelations = relations(complaintMedia, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintMedia.complaintId],
    references: [complaints.id],
  }),
}));

export const crewsRelations = relations(crews, ({ one, many }) => ({
  department: one(departments, {
    fields: [crews.departmentId],
    references: [departments.id],
  }),
  municipality: one(municipalities, {
    fields: [crews.municipalityId],
    references: [municipalities.id],
  }),
  members: many(crewMembers),
  credits: many(crewCredits),
  assignments: many(assignments),
}));
