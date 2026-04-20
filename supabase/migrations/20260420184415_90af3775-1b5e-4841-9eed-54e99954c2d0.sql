-- Performance indexes for frequently filtered columns
-- All use IF NOT EXISTS to be idempotent

-- Evolutions: filtered by user/patient/clinic + date ranges
CREATE INDEX IF NOT EXISTS idx_evolutions_user_date ON public.evolutions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_evolutions_patient_date ON public.evolutions(patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_evolutions_clinic_date ON public.evolutions(clinic_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_evolutions_group_date ON public.evolutions(group_id, date DESC) WHERE group_id IS NOT NULL;

-- Appointments: agenda lookups
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON public.appointments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON public.appointments(patient_id, date);

-- Private appointments (services)
CREATE INDEX IF NOT EXISTS idx_private_appts_user_date ON public.private_appointments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_private_appts_clinic_date ON public.private_appointments(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_private_appts_patient ON public.private_appointments(patient_id) WHERE patient_id IS NOT NULL;

-- Patients: very frequent filters
CREATE INDEX IF NOT EXISTS idx_patients_user_status ON public.patients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_archived ON public.patients(user_id) WHERE is_archived = false;

-- Portal tables: accessed on every patient session
CREATE INDEX IF NOT EXISTS idx_portal_messages_patient ON public.portal_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_messages_account ON public.portal_messages(portal_account_id, created_at DESC) WHERE portal_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portal_messages_unread_patient ON public.portal_messages(patient_id) WHERE read_by_patient = false;
CREATE INDEX IF NOT EXISTS idx_portal_messages_unread_therapist ON public.portal_messages(therapist_user_id) WHERE read_by_therapist = false;

CREATE INDEX IF NOT EXISTS idx_portal_notices_patient ON public.portal_notices(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notices_account ON public.portal_notices(portal_account_id) WHERE portal_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_activities_patient ON public.portal_activities(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_activities_account ON public.portal_activities(portal_account_id) WHERE portal_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_documents_patient ON public.portal_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_documents_account ON public.portal_documents(portal_account_id);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_patient ON public.patient_portal_accounts(patient_id);
CREATE INDEX IF NOT EXISTS idx_portal_accounts_user ON public.patient_portal_accounts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portal_accounts_therapist ON public.patient_portal_accounts(therapist_user_id);

-- Payments: monthly lookups
CREATE INDEX IF NOT EXISTS idx_patient_payments_lookup ON public.patient_payment_records(patient_id, year, month);
CREATE INDEX IF NOT EXISTS idx_patient_payments_clinic_period ON public.patient_payment_records(clinic_id, year, month);
CREATE INDEX IF NOT EXISTS idx_clinic_payments_lookup ON public.clinic_payment_records(clinic_id, year, month);

-- Internal notifications (header bell)
CREATE INDEX IF NOT EXISTS idx_internal_notif_recipient_unread ON public.internal_notifications(recipient_user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_internal_notif_recipient_created ON public.internal_notifications(recipient_user_id, created_at DESC);

-- Feed
CREATE INDEX IF NOT EXISTS idx_feed_posts_patient ON public.feed_posts(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_therapist ON public.feed_posts(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_group ON public.feed_posts(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON public.feed_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON public.feed_reactions(post_id);

-- Evolution feedbacks
CREATE INDEX IF NOT EXISTS idx_evolution_feedbacks_patient ON public.evolution_feedbacks(patient_id, created_at DESC);

-- Patient documents and contracts
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON public.patient_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_contracts_patient ON public.patient_contracts(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_contracts_therapist ON public.patient_contracts(therapist_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_patient ON public.patient_questionnaires(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_intake_patient ON public.patient_intake_forms(patient_id);

-- Calendar blocks & events
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_user_dates ON public.calendar_blocks(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_clinic ON public.calendar_blocks(clinic_id, start_date, end_date) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_user_date ON public.events(user_id, date);

-- Organization members (permission lookups)
CREATE INDEX IF NOT EXISTS idx_org_members_user_active ON public.organization_members(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_org_members_org_active ON public.organization_members(organization_id) WHERE status = 'active';

-- Clinics
CREATE INDEX IF NOT EXISTS idx_clinics_user_active ON public.clinics(user_id) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_clinics_org ON public.clinics(organization_id) WHERE organization_id IS NOT NULL;

-- Notes
CREATE INDEX IF NOT EXISTS idx_clinic_notes_clinic ON public.clinic_notes(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_notes_group ON public.clinic_notes(group_id, created_at DESC) WHERE group_id IS NOT NULL;

-- Notice reads
CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON public.notice_reads(user_id, notice_id);

-- Push tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

-- Attachments (parent lookup)
CREATE INDEX IF NOT EXISTS idx_attachments_parent ON public.attachments(parent_type, parent_id);