-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('L0', 'L1', 'L2');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'SUSPENDED', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'ADD_PHONE', 'DELETE_ACCOUNT', 'REACTIVATE');

-- CreateEnum
CREATE TYPE "KycProvider" AS ENUM ('DIDIT');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'APPROVED', 'DECLINED', 'IN_REVIEW', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OccupationStatus" AS ENUM ('STUDENT', 'EMPLOYEE', 'ENTREPRENEUR', 'JOB_SEEKER', 'OTHER');

-- CreateEnum
CREATE TYPE "HelpType" AS ENUM ('PAPERWORK', 'HOUSING', 'JOB', 'WELCOME', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING_EMAIL', 'JOURNEY_VISIBILITY');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'READY', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CountryKind" AS ENUM ('ORIGIN', 'DESTINATION', 'BOTH');

-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StepCategory" AS ENUM ('PRE_DEPARTURE', 'ARRIVAL', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "BlockerTarget" AS ENUM ('HELP', 'HOUSING', 'JOBS', 'MENTORSHIP', 'NONE');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JourneyVisibility" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "JourneyStepStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'PAUSED');

-- CreateEnum
CREATE TYPE "JourneyMemberRole" AS ENUM ('OBSERVER', 'SUPPORTER');

-- CreateEnum
CREATE TYPE "JourneyMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "JourneyActivityType" AS ENUM ('STEP_STARTED', 'STEP_DONE', 'STEP_PAUSED', 'BLOCKER_PUBLISHED', 'HELP_RECEIVED', 'MEMBER_JOINED', 'MILESTONE_SHARED', 'NOTE');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CorrectionProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('VICTORY', 'QUESTION', 'INFO', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'CLEARED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('BRAVO', 'USEFUL', 'SUPPORT', 'LIKE');

-- CreateEnum
CREATE TYPE "CommentSubjectType" AS ENUM ('POST', 'TOPIC', 'GUIDE', 'EVENT');

-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('CONSEIL', 'DECOUVERTE', 'INFORMATION');

-- CreateEnum
CREATE TYPE "StoryTextStyle" AS ENUM ('BOLD', 'SERIF', 'MONO');

-- CreateEnum
CREATE TYPE "StoryAudience" AS ENUM ('ALL', 'CITY');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "StoryReactionKind" AS ENUM ('USEFUL', 'NOT_USEFUL', 'WANT_TO_GO', 'BEEN_THERE', 'CONFIRM', 'CHANGED');

-- CreateEnum
CREATE TYPE "GuideCategory" AS ENUM ('PRE_DEPARTURE', 'ARRIVAL', 'HOUSING', 'DAILY_LIFE', 'WORK_STUDIES', 'SCAM_ALERTS');

-- CreateEnum
CREATE TYPE "GuideScope" AS ENUM ('UNIVERSAL', 'COUNTRY');

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FLAGGED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GuideVoteValue" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "GuideProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'AMENDED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "HelpKind" AS ENUM ('REQUEST', 'OFFER');

-- CreateEnum
CREATE TYPE "HelpType2" AS ENUM ('PAPERWORK', 'SERVICE', 'RIDE', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "HelpStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunityKind" AS ENUM ('CITY', 'COUNTRY', 'INTEREST');

-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('PUBLIC', 'ON_REQUEST', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunityMemberRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "CommunityMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'INVITED', 'BANNED');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TopicPinKind" AS ENUM ('NONE', 'RULES', 'RESOURCE', 'WELCOME');

-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MentorshipEndReason" AS ENUM ('COMPLETED', 'MENTOR_LEFT', 'MENTEE_LEFT', 'BLOCKED', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConnectionOrigin" AS ENUM ('HELP_VALIDATED', 'MENTORSHIP', 'EVENT', 'GUIDE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'JOURNEY', 'MENTORSHIP');

-- CreateEnum
CREATE TYPE "CityTipKind" AS ENUM ('TIP', 'SHOP', 'BUDGET', 'TESTIMONY');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PICNIC', 'SPORT', 'CV_WORKSHOP', 'COOKING', 'NETWORKING', 'OUTING', 'CONFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('GOING', 'MAYBE', 'DECLINED', 'WAITLIST');

-- CreateEnum
CREATE TYPE "HousingKind" AS ENUM ('RENT', 'FLATSHARE', 'SUBLET', 'TEMPORARY', 'SEEKING_HOUSING', 'SEEKING_FLATMATE');

-- CreateEnum
CREATE TYPE "HousingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TAKEN', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('JOB', 'INTERNSHIP', 'APPRENTICESHIP', 'GIG');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProContactMethod" AS ENUM ('PLATFORM_MESSAGE', 'EMAIL', 'PHONE_ON_REQUEST');

-- CreateEnum
CREATE TYPE "ProVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProTier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "ProStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('HOUSING', 'JOB');

-- CreateEnum
CREATE TYPE "SearchSubjectType" AS ENUM ('GUIDE', 'TOPIC', 'HELP_REQUEST', 'HOUSING', 'JOB', 'EVENT', 'USER', 'CITY', 'PRO');

-- CreateEnum
CREATE TYPE "SearchVisibility" AS ENUM ('PUBLIC', 'COMMUNITY', 'NONE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ReportSubjectType" AS ENUM ('POST', 'COMMENT', 'TOPIC', 'GUIDE', 'HELP_REQUEST', 'HELP_RESPONSE', 'HOUSING', 'JOB', 'PRO', 'EVENT', 'MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SCAM', 'MONEY_REQUEST', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NEW', 'ATTACHED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('REPORT', 'AI', 'RISK_SCORE', 'AUTO_RULE');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AiVerdict" AS ENUM ('ALLOW', 'QUEUE', 'BLOCK');

-- CreateEnum
CREATE TYPE "ModerationResolution" AS ENUM ('KEEP', 'HIDE', 'REMOVE', 'WARN', 'SUSPEND');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE', 'UNHIDE', 'REMOVE', 'WARN', 'SUSPEND_USER', 'BAN_USER', 'DISMISS', 'NOTE');

-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'SUSPENSION', 'BAN');

-- CreateEnum
CREATE TYPE "ScamAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PREMIUM', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProviderKind" AS ENUM ('STRIPE', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('CARD', 'MTN_MOMO', 'MOOV_MONEY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('EVENTS_CREATED', 'PRO_CONTACTS');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('INSURANCE', 'AIRLINE', 'BANK', 'REMITTANCE', 'HOUSING_GUARANTEE', 'TELECOM', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutModel" AS ENUM ('CPA', 'CPC', 'FLAT');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('STAFF', 'SYSTEM', 'MEMBER');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('AVATAR', 'POST', 'HOUSING', 'EVENT_COVER', 'ALBUM', 'MESSAGE', 'PROOF', 'LOGO', 'EXPORT', 'INVOICE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'SCANNING', 'READY', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookmarkSubjectType" AS ENUM ('STORY', 'GUIDE', 'POST', 'HELP_REQUEST', 'EVENT', 'HOUSING', 'JOB', 'PRO', 'MENTOR', 'USER', 'TOPIC', 'CITY');

-- CreateEnum
CREATE TYPE "ReputationEventType" AS ENUM ('HELP_VALIDATED', 'GUIDE_HELPFUL_VOTE', 'GUIDE_CONTRIBUTION', 'MENTORSHIP_COMPLETED', 'EVENT_ORGANIZED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "handle" CITEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_asset_id" UUID,
    "phase" "Phase" NOT NULL,
    "verification_level" "VerificationLevel" NOT NULL,
    "origin_country_id" UUID NOT NULL,
    "city_id" UUID,
    "arrival_date" DATE,
    "planned_departure_date" DATE,
    "plan" "UserPlan" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "last_seen_at" TIMESTAMPTZ,
    "deactivated_at" TIMESTAMPTZ,
    "origin_country_locked_at" TIMESTAMPTZ,
    "handle_changed_at" TIMESTAMPTZ,
    "phase_set_manually_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "phone_encrypted" BYTEA NOT NULL,
    "phone_hmac" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "is_destination" BOOLEAN NOT NULL,
    "verified_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone_hmac" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "ip" INET,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "ip" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "level_refresh_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "KycProvider" NOT NULL,
    "provider_session_id" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL,
    "is_adult" BOOLEAN,
    "decline_reason_code" TEXT,
    "decided_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "bio" TEXT,
    "occupation_status" "OccupationStatus" NOT NULL,
    "available_to_help" BOOLEAN NOT NULL,
    "help_types" "HelpType"[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_languages" (
    "user_id" UUID NOT NULL,
    "language_id" UUID NOT NULL,

    CONSTRAINT "user_languages_pkey" PRIMARY KEY ("user_id","language_id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("user_id","skill_id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "help_validated_count" INTEGER NOT NULL DEFAULT 0,
    "guide_helpful_votes" INTEGER NOT NULL DEFAULT 0,
    "guide_contributions" INTEGER NOT NULL DEFAULT 0,
    "mentorships_completed" INTEGER NOT NULL DEFAULT 0,
    "events_organized" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip" INET,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL,
    "execute_after" TIMESTAMPTZ NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "executed_at" TIMESTAMPTZ,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL,
    "asset_id" UUID,
    "ready_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "iso2" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "dial_code" TEXT NOT NULL,
    "kind" "CountryKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "default_city_id" UUID,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "country_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "region" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "merged_into_city_id" UUID,
    "postal_prefix" TEXT,
    "activated_at" TIMESTAMPTZ,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "name_fr" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "name_fr" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "professions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_templates" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "description" TEXT,
    "target_phase" "Phase" NOT NULL,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "journey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_template_versions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "origin_country_id" UUID,
    "status" "TemplateVersionStatus" NOT NULL,
    "changelog" TEXT,
    "published_at" TIMESTAMPTZ,
    "published_by_staff_id" UUID,

    CONSTRAINT "journey_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_definitions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "description" TEXT,
    "category" "StepCategory" NOT NULL,
    "default_duration_days" INTEGER,
    "guide_id" UUID,
    "blocker_target" "BlockerTarget" NOT NULL,
    "blocker_template" TEXT,
    "is_major_milestone" BOOLEAN NOT NULL,
    "is_risky" BOOLEAN NOT NULL,
    "risk_message" TEXT,
    "document_checklist" TEXT[],

    CONSTRAINT "step_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_steps" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "template_version_id" UUID NOT NULL,
    "step_definition_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "is_optional" BOOLEAN NOT NULL,
    "days_before_arrival" INTEGER,
    "overrides" JSONB,

    CONSTRAINT "template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_dependencies" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_version_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "depends_on_step_id" UUID NOT NULL,

    CONSTRAINT "step_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journeys" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "owner_user_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JourneyStatus" NOT NULL,
    "visibility" "JourneyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "origin_country_id" UUID NOT NULL,
    "destination_city_id" UUID NOT NULL,
    "target_arrival_date" DATE,
    "current_step_id" UUID,
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "group_conversation_id" UUID,
    "last_activity_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "inactivity_prompt_sent_at" TIMESTAMPTZ,

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_steps" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "journey_id" UUID NOT NULL,
    "template_step_id" UUID,
    "step_definition_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "status" "JourneyStepStatus" NOT NULL,
    "due_date" DATE,
    "due_date_manual" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "paused_at" TIMESTAMPTZ,
    "duration_days" INTEGER,
    "notes_encrypted" BYTEA,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "share_prompt_dismissed_at" TIMESTAMPTZ,

    CONSTRAINT "journey_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_step_checklist_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "journey_step_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMPTZ,

    CONSTRAINT "journey_step_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_members" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "journey_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "JourneyMemberRole" NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "status" "JourneyMemberStatus" NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,

    CONSTRAINT "journey_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_activities" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journey_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "journey_step_id" UUID,
    "type" "JourneyActivityType" NOT NULL,
    "ref_type" TEXT,
    "ref_id" UUID,
    "payload" JSONB,

    CONSTRAINT "journey_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocker_requests" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "journey_id" UUID NOT NULL,
    "journey_step_id" UUID NOT NULL,
    "target" "BlockerTarget" NOT NULL,
    "is_private" BOOLEAN NOT NULL,
    "draft_text" TEXT NOT NULL,
    "status" "BlockerStatus" NOT NULL,
    "published_ref_type" TEXT,
    "published_ref_id" UUID,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "blocker_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_correction_proposals" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "template_version_id" UUID NOT NULL,
    "step_definition_id" UUID,
    "user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CorrectionProposalStatus" NOT NULL,
    "reviewed_by_staff_id" UUID,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "template_correction_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID NOT NULL,
    "type" "PostType" NOT NULL,
    "body" TEXT NOT NULL,
    "city_id" UUID,
    "community_id" UUID,
    "journey_id" UUID,
    "journey_step_id" UUID,
    "status" "ContentStatus" NOT NULL,
    "moderation_status" "ModerationStatus" NOT NULL,
    "reaction_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "moved_to_topic_id" UUID,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "post_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ReactionKind" NOT NULL,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "subject_type" "CommentSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID NOT NULL,
    "type" "StoryType" NOT NULL,
    "body" TEXT NOT NULL,
    "background_color" TEXT,
    "background_asset_id" UUID,
    "text_style" "StoryTextStyle" NOT NULL,
    "city_id" UUID NOT NULL,
    "step_definition_id" UUID,
    "category" TEXT,
    "place_label" TEXT,
    "valid_until" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "audience" "StoryAudience" NOT NULL,
    "allow_messages" BOOLEAN NOT NULL,
    "positive_count" INTEGER NOT NULL DEFAULT 0,
    "negative_count" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" "StoryStatus" NOT NULL,
    "moderation_status" "ModerationStatus" NOT NULL,
    "converted_to_type" TEXT,
    "converted_to_id" UUID,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_reactions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "story_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "StoryReactionKind" NOT NULL,

    CONSTRAINT "story_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_views" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "story_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "GuideCategory" NOT NULL,
    "scope" "GuideScope" NOT NULL,
    "origin_country_id" UUID,
    "city_id" UUID,
    "current_version_id" UUID,
    "status" "GuideStatus" NOT NULL,
    "maintained_by_community" BOOLEAN NOT NULL DEFAULT false,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "freshness_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "last_content_update_at" TIMESTAMPTZ NOT NULL,
    "outdated_flag_count" INTEGER NOT NULL DEFAULT 0,
    "unpublish_deadline_at" TIMESTAMPTZ,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_versions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guide_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "created_by_user_id" UUID,
    "source_proposal_id" UUID,

    CONSTRAINT "guide_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_votes" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guide_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "value" "GuideVoteValue" NOT NULL,

    CONSTRAINT "guide_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_revision_proposals" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "guide_id" UUID NOT NULL,
    "proposer_user_id" UUID NOT NULL,
    "base_version_id" UUID NOT NULL,
    "target_excerpt" TEXT NOT NULL,
    "replacement" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source_url" TEXT,
    "status" "GuideProposalStatus" NOT NULL,
    "escalate_at" TIMESTAMPTZ NOT NULL,
    "reviewer_user_id" UUID,
    "reviewer_staff_id" UUID,
    "reject_reason" TEXT,
    "decided_at" TIMESTAMPTZ,

    CONSTRAINT "guide_revision_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_contributors" (
    "guide_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "first_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "guide_contributors_pkey" PRIMARY KEY ("guide_id","user_id")
);

-- CreateTable
CREATE TABLE "guide_outdated_flags" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guide_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT,

    CONSTRAINT "guide_outdated_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_requests" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID NOT NULL,
    "kind" "HelpKind" NOT NULL,
    "type" "HelpType2" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "city_id" UUID NOT NULL,
    "status" "HelpStatus" NOT NULL,
    "origin_journey_step_id" UUID,
    "origin_blocker_id" UUID,
    "due_date" DATE,
    "response_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_response_id" UUID,
    "moderation_status" "ModerationStatus" NOT NULL,

    CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_responses" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "help_request_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "marked_helpful" BOOLEAN NOT NULL DEFAULT false,
    "marked_at" TIMESTAMPTZ,

    CONSTRAINT "help_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "kind" "CommunityKind" NOT NULL,
    "city_id" UUID,
    "country_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "visibility" "CommunityVisibility" NOT NULL,
    "created_by_user_id" UUID,
    "cover_asset_id" UUID,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CommunityStatus" NOT NULL,
    "last_activity_at" TIMESTAMPTZ NOT NULL,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "community_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CommunityMemberRole" NOT NULL,
    "status" "CommunityMemberStatus" NOT NULL,
    "joined_at" TIMESTAMPTZ,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "community_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL,
    "pin_kind" "TopicPinKind" NOT NULL,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMPTZ,
    "origin_post_id" UUID,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_announcements" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "community_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "notified_at" TIMESTAMPTZ,

    CONSTRAINT "community_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "community_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "is_multiple" BOOLEAN NOT NULL,
    "closes_at" TIMESTAMPTZ,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poll_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "vote_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poll_option_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "community_id" UUID NOT NULL,
    "event_id" UUID,
    "title" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_photos" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "album_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "caption" TEXT,

    CONSTRAINT "album_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "is_available" BOOLEAN NOT NULL,
    "max_mentees" INTEGER NOT NULL DEFAULT 2,
    "active_mentee_count" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "journey_template_ids" UUID[],
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(3,2),
    "enabled_at" TIMESTAMPTZ NOT NULL,
    "disabled_at" TIMESTAMPTZ,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "mentorships" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "mentor_user_id" UUID NOT NULL,
    "mentee_user_id" UUID NOT NULL,
    "journey_id" UUID,
    "status" "MentorshipStatus" NOT NULL,
    "request_message" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "end_reason" "MentorshipEndReason",
    "conversation_id" UUID,

    CONSTRAINT "mentorships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_reviews" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mentorship_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "reviewee_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "mentorship_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "origin" "ConnectionOrigin" NOT NULL,
    "origin_ref_type" TEXT,
    "origin_ref_id" UUID,
    "removed_at" TIMESTAMPTZ,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_requests" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ConnectionRequestStatus" NOT NULL,
    "decided_at" TIMESTAMPTZ,

    CONSTRAINT "connection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocker_user_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "journey_id" UUID,
    "mentorship_id" UUID,
    "last_message_at" TIMESTAMPTZ,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL,
    "left_at" TIMESTAMPTZ,
    "last_read_at" TIMESTAMPTZ,
    "is_muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "body_encrypted" BYTEA NOT NULL,
    "media_asset_id" UUID,
    "sent_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_tips" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "city_id" UUID NOT NULL,
    "author_user_id" UUID,
    "kind" "CityTipKind" NOT NULL,
    "body" TEXT NOT NULL,
    "amount_cents" INTEGER,
    "source_story_id" UUID,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL,

    CONSTRAINT "city_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "organizer_user_id" UUID NOT NULL,
    "community_id" UUID,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "city_id" UUID NOT NULL,
    "venue_name" TEXT,
    "address_text" TEXT,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "capacity" INTEGER,
    "attendee_count" INTEGER NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL,
    "cover_asset_id" UUID,
    "reminder_sent_at" TIMESTAMPTZ,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendees" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "AttendeeStatus" NOT NULL,
    "responded_at" TIMESTAMPTZ NOT NULL,
    "checked_in" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housing_listings" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID NOT NULL,
    "kind" "HousingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city_id" UUID NOT NULL,
    "district" TEXT,
    "price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "is_furnished" BOOLEAN,
    "available_from" DATE,
    "duration_months" INTEGER,
    "status" "HousingStatus" NOT NULL,
    "risk_score" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "risk_flags" TEXT[],
    "moderation_status" "ModerationStatus" NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "contact_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "housing_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housing_photos" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listing_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "housing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_listings" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "author_user_id" UUID NOT NULL,
    "kind" "JobKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "company_name" TEXT,
    "city_id" UUID,
    "contract_type" TEXT,
    "sector" TEXT,
    "education_level" TEXT,
    "external_url" TEXT,
    "is_sponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsored_until" TIMESTAMPTZ,
    "status" "JobStatus" NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_seeker_profiles" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "headline" TEXT NOT NULL,
    "sectors" TEXT[],
    "contract_types" TEXT[],
    "is_visible" BOOLEAN NOT NULL,

    CONSTRAINT "job_seeker_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "member_recommendations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "job_listing_id" UUID,
    "comment" TEXT,

    CONSTRAINT "member_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_profiles" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "user_id" UUID NOT NULL,
    "profession_id" UUID NOT NULL,
    "business_name" TEXT,
    "description" TEXT,
    "price_hint" TEXT,
    "contact_method" "ProContactMethod" NOT NULL,
    "siret" TEXT,
    "proof_asset_id" UUID,
    "verification_status" "ProVerificationStatus" NOT NULL,
    "tier" "ProTier" NOT NULL,
    "tier_until" TIMESTAMPTZ,
    "status" "ProStatus" NOT NULL,
    "recommendation_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pro_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_profile_cities" (
    "pro_profile_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,

    CONSTRAINT "pro_profile_cities_pkey" PRIMARY KEY ("pro_profile_id","city_id")
);

-- CreateTable
CREATE TABLE "pro_recommendations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pro_profile_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "comment" TEXT,

    CONSTRAINT "pro_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_contact_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pro_profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,

    CONSTRAINT "pro_contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_alerts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "criteria" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "last_notified_at" TIMESTAMPTZ,

    CONSTRAINT "saved_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_documents" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "subject_type" "SearchSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "city_id" UUID,
    "country_id" UUID,
    "community_id" UUID,
    "visibility" "SearchVisibility" NOT NULL,
    "tsv" tsvector NOT NULL,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_zero_results" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query_normalized" TEXT NOT NULL,
    "city_id" UUID,
    "occurred_on" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "search_zero_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "ref_type" TEXT,
    "ref_id" UUID,
    "read_at" TIMESTAMPTZ,
    "channels_sent" TEXT[],
    "category" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "push" JSONB NOT NULL,
    "email" JSONB NOT NULL,
    "weekly_digest" BOOLEAN NOT NULL,
    "quiet_hours" JSONB,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_success_at" TIMESTAMPTZ,
    "failure_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "NotificationChannel" NOT NULL,
    "user_id" UUID,
    "template" TEXT NOT NULL,
    "status" "OutboundStatus" NOT NULL,
    "provider_ref" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporter_user_id" UUID NOT NULL,
    "subject_type" "ReportSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL,
    "case_id" UUID,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "subject_type" "ReportSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_author_user_id" UUID,
    "source" "ModerationSource" NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL,
    "ai_verdict" "AiVerdict",
    "ai_labels" TEXT[],
    "ai_score" DECIMAL(4,3),
    "assigned_staff_id" UUID,
    "sla_due_at" TIMESTAMPTZ NOT NULL,
    "resolution" "ModerationResolution",
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_id" UUID NOT NULL,
    "staff_id" UUID,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanctions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "SanctionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "issued_by_staff_id" UUID NOT NULL,
    "case_id" UUID,
    "lifted_at" TIMESTAMPTZ,

    CONSTRAINT "sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scam_alerts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "ScamAlertSeverity" NOT NULL,
    "city_id" UUID,
    "country_id" UUID,
    "is_pinned" BOOLEAN NOT NULL,
    "published_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_by_staff_id" UUID NOT NULL,
    "related_case_id" UUID,

    CONSTRAINT "scam_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_moderation_checks" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject_type" "ReportSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "verdict" "AiVerdict" NOT NULL,
    "labels" TEXT[],
    "score" DECIMAL(4,3),
    "redacted" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,

    CONSTRAINT "ai_moderation_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name_fr" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" "PlanInterval" NOT NULL,
    "limits" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "pro_profile_id" UUID,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL,
    "provider_ref" TEXT,
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL,
    "method" "PaymentMethodKind" NOT NULL,
    "provider_ref" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "failure_code" TEXT,
    "invoice_number" TEXT,
    "invoice_asset_id" UUID,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "user_id" UUID NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "period_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("user_id","metric","period_key")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PartnerCategory" NOT NULL,
    "logo_asset_id" UUID,
    "affiliate_url_template" TEXT NOT NULL,
    "payout_model" "PayoutModel" NOT NULL,
    "contract_start" DATE,
    "contract_end" DATE,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_placements" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "partner_id" UUID NOT NULL,
    "step_definition_id" UUID NOT NULL,
    "origin_country_id" UUID,
    "destination_country_id" UUID,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta_label" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "partner_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placement_id" UUID NOT NULL,
    "user_id" UUID,
    "journey_step_id" UUID,
    "clicked_at" TIMESTAMPTZ NOT NULL,
    "converted_at" TIMESTAMPTZ,
    "conversion_ref" TEXT,
    "payout_cents" INTEGER,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "email" CITEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_encrypted" BYTEA NOT NULL,
    "role" "StaffRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" INET,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "metadata" JSONB,
    "ip" INET,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "key" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "rollout_pct" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_pages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ,
    "updated_by_staff_id" UUID,

    CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target" JSONB,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "created_by_staff_id" UUID NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_staff_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "owner_user_id" UUID,
    "kind" "MediaKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "MediaStatus" NOT NULL,
    "exif_stripped" BOOLEAN NOT NULL DEFAULT false,
    "variants" JSONB,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "subject_type" "BookmarkSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "type" "ReputationEventType" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE INDEX "users_phase_idx" ON "users"("phase");

-- CreateIndex
CREATE INDEX "users_verification_level_idx" ON "users"("verification_level");

-- CreateIndex
CREATE INDEX "users_origin_country_id_idx" ON "users"("origin_country_id");

-- CreateIndex
CREATE INDEX "users_city_id_idx" ON "users"("city_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_phone_hmac_key" ON "phone_numbers"("phone_hmac");

-- CreateIndex
CREATE INDEX "phone_numbers_user_id_idx" ON "phone_numbers"("user_id");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_hmac_idx" ON "otp_challenges"("phone_hmac");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_provider_session_id_key" ON "kyc_verifications"("provider_session_id");

-- CreateIndex
CREATE INDEX "kyc_verifications_user_id_idx" ON "kyc_verifications"("user_id");

-- CreateIndex
CREATE INDEX "kyc_verifications_status_idx" ON "kyc_verifications"("status");

-- CreateIndex
CREATE INDEX "user_profiles_available_to_help_idx" ON "user_profiles"("available_to_help");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE INDEX "account_deletion_requests_user_id_idx" ON "account_deletion_requests"("user_id");

-- CreateIndex
CREATE INDEX "data_exports_user_id_idx" ON "data_exports"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE INDEX "countries_is_active_idx" ON "countries"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_country_id_idx" ON "cities"("country_id");

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_fr_key" ON "skills"("name_fr");

-- CreateIndex
CREATE UNIQUE INDEX "professions_name_fr_key" ON "professions"("name_fr");

-- CreateIndex
CREATE UNIQUE INDEX "journey_templates_code_key" ON "journey_templates"("code");

-- CreateIndex
CREATE INDEX "journey_template_versions_template_id_idx" ON "journey_template_versions"("template_id");

-- CreateIndex
CREATE INDEX "journey_template_versions_origin_country_id_idx" ON "journey_template_versions"("origin_country_id");

-- CreateIndex
CREATE INDEX "journey_template_versions_status_idx" ON "journey_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "journey_template_versions_template_id_version_origin_countr_key" ON "journey_template_versions"("template_id", "version", "origin_country_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_code_key" ON "step_definitions"("code");

-- CreateIndex
CREATE INDEX "template_steps_template_version_id_idx" ON "template_steps"("template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_steps_template_version_id_position_key" ON "template_steps"("template_version_id", "position");

-- CreateIndex
CREATE INDEX "step_dependencies_template_version_id_idx" ON "step_dependencies"("template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_dependencies_step_id_depends_on_step_id_key" ON "step_dependencies"("step_id", "depends_on_step_id");

-- CreateIndex
CREATE INDEX "journeys_owner_user_id_idx" ON "journeys"("owner_user_id");

-- CreateIndex
CREATE INDEX "journeys_template_version_id_idx" ON "journeys"("template_version_id");

-- CreateIndex
CREATE INDEX "journeys_status_idx" ON "journeys"("status");

-- CreateIndex
CREATE INDEX "journeys_visibility_idx" ON "journeys"("visibility");

-- CreateIndex
CREATE INDEX "journeys_destination_city_id_idx" ON "journeys"("destination_city_id");

-- CreateIndex
CREATE INDEX "journeys_last_activity_at_idx" ON "journeys"("last_activity_at");

-- CreateIndex
CREATE INDEX "journey_steps_journey_id_idx" ON "journey_steps"("journey_id");

-- CreateIndex
CREATE INDEX "journey_steps_status_idx" ON "journey_steps"("status");

-- CreateIndex
CREATE INDEX "journey_steps_due_date_idx" ON "journey_steps"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "journey_steps_journey_id_position_key" ON "journey_steps"("journey_id", "position");

-- CreateIndex
CREATE INDEX "journey_step_checklist_items_journey_step_id_idx" ON "journey_step_checklist_items"("journey_step_id");

-- CreateIndex
CREATE INDEX "journey_members_journey_id_idx" ON "journey_members"("journey_id");

-- CreateIndex
CREATE INDEX "journey_members_user_id_idx" ON "journey_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "journey_members_journey_id_user_id_key" ON "journey_members"("journey_id", "user_id");

-- CreateIndex
CREATE INDEX "journey_activities_journey_id_idx" ON "journey_activities"("journey_id");

-- CreateIndex
CREATE INDEX "blocker_requests_journey_id_idx" ON "blocker_requests"("journey_id");

-- CreateIndex
CREATE INDEX "blocker_requests_journey_step_id_idx" ON "blocker_requests"("journey_step_id");

-- CreateIndex
CREATE INDEX "template_correction_proposals_template_version_id_idx" ON "template_correction_proposals"("template_version_id");

-- CreateIndex
CREATE INDEX "template_correction_proposals_status_idx" ON "template_correction_proposals"("status");

-- CreateIndex
CREATE INDEX "posts_author_user_id_idx" ON "posts"("author_user_id");

-- CreateIndex
CREATE INDEX "posts_type_idx" ON "posts"("type");

-- CreateIndex
CREATE INDEX "posts_city_id_idx" ON "posts"("city_id");

-- CreateIndex
CREATE INDEX "posts_community_id_idx" ON "posts"("community_id");

-- CreateIndex
CREATE INDEX "posts_journey_step_id_idx" ON "posts"("journey_step_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "post_media_post_id_idx" ON "post_media"("post_id");

-- CreateIndex
CREATE INDEX "post_reactions_post_id_idx" ON "post_reactions"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_key" ON "post_reactions"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "comments_subject_type_subject_id_idx" ON "comments"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "comments_author_user_id_idx" ON "comments"("author_user_id");

-- CreateIndex
CREATE INDEX "stories_author_user_id_idx" ON "stories"("author_user_id");

-- CreateIndex
CREATE INDEX "stories_type_idx" ON "stories"("type");

-- CreateIndex
CREATE INDEX "stories_city_id_idx" ON "stories"("city_id");

-- CreateIndex
CREATE INDEX "stories_step_definition_id_idx" ON "stories"("step_definition_id");

-- CreateIndex
CREATE INDEX "stories_category_idx" ON "stories"("category");

-- CreateIndex
CREATE INDEX "stories_expires_at_idx" ON "stories"("expires_at");

-- CreateIndex
CREATE INDEX "stories_score_idx" ON "stories"("score");

-- CreateIndex
CREATE INDEX "stories_status_idx" ON "stories"("status");

-- CreateIndex
CREATE INDEX "story_reactions_story_id_idx" ON "story_reactions"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_reactions_story_id_user_id_key" ON "story_reactions"("story_id", "user_id");

-- CreateIndex
CREATE INDEX "story_views_story_id_idx" ON "story_views"("story_id");

-- CreateIndex
CREATE INDEX "story_views_user_id_idx" ON "story_views"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_views_story_id_user_id_key" ON "story_views"("story_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guides_slug_key" ON "guides"("slug");

-- CreateIndex
CREATE INDEX "guides_author_user_id_idx" ON "guides"("author_user_id");

-- CreateIndex
CREATE INDEX "guides_category_idx" ON "guides"("category");

-- CreateIndex
CREATE INDEX "guides_origin_country_id_idx" ON "guides"("origin_country_id");

-- CreateIndex
CREATE INDEX "guides_city_id_idx" ON "guides"("city_id");

-- CreateIndex
CREATE INDEX "guides_status_idx" ON "guides"("status");

-- CreateIndex
CREATE INDEX "guides_freshness_score_idx" ON "guides"("freshness_score");

-- CreateIndex
CREATE INDEX "guides_last_content_update_at_idx" ON "guides"("last_content_update_at");

-- CreateIndex
CREATE INDEX "guide_versions_guide_id_idx" ON "guide_versions"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_versions_guide_id_version_key" ON "guide_versions"("guide_id", "version");

-- CreateIndex
CREATE INDEX "guide_votes_guide_id_idx" ON "guide_votes"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_votes_guide_id_user_id_key" ON "guide_votes"("guide_id", "user_id");

-- CreateIndex
CREATE INDEX "guide_revision_proposals_guide_id_idx" ON "guide_revision_proposals"("guide_id");

-- CreateIndex
CREATE INDEX "guide_revision_proposals_proposer_user_id_idx" ON "guide_revision_proposals"("proposer_user_id");

-- CreateIndex
CREATE INDEX "guide_revision_proposals_status_idx" ON "guide_revision_proposals"("status");

-- CreateIndex
CREATE INDEX "guide_contributors_guide_id_idx" ON "guide_contributors"("guide_id");

-- CreateIndex
CREATE INDEX "guide_outdated_flags_guide_id_idx" ON "guide_outdated_flags"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_outdated_flags_guide_id_user_id_key" ON "guide_outdated_flags"("guide_id", "user_id");

-- CreateIndex
CREATE INDEX "help_requests_author_user_id_idx" ON "help_requests"("author_user_id");

-- CreateIndex
CREATE INDEX "help_requests_type_idx" ON "help_requests"("type");

-- CreateIndex
CREATE INDEX "help_requests_city_id_idx" ON "help_requests"("city_id");

-- CreateIndex
CREATE INDEX "help_requests_status_idx" ON "help_requests"("status");

-- CreateIndex
CREATE INDEX "help_requests_origin_journey_step_id_idx" ON "help_requests"("origin_journey_step_id");

-- CreateIndex
CREATE INDEX "help_requests_created_at_idx" ON "help_requests"("created_at");

-- CreateIndex
CREATE INDEX "help_responses_help_request_id_idx" ON "help_responses"("help_request_id");

-- CreateIndex
CREATE INDEX "help_responses_author_user_id_idx" ON "help_responses"("author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE INDEX "communities_kind_idx" ON "communities"("kind");

-- CreateIndex
CREATE INDEX "communities_city_id_idx" ON "communities"("city_id");

-- CreateIndex
CREATE INDEX "communities_country_id_idx" ON "communities"("country_id");

-- CreateIndex
CREATE INDEX "communities_status_idx" ON "communities"("status");

-- CreateIndex
CREATE INDEX "communities_last_activity_at_idx" ON "communities"("last_activity_at");

-- CreateIndex
CREATE INDEX "community_members_community_id_idx" ON "community_members"("community_id");

-- CreateIndex
CREATE INDEX "community_members_user_id_idx" ON "community_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_community_id_user_id_key" ON "community_members"("community_id", "user_id");

-- CreateIndex
CREATE INDEX "topics_community_id_idx" ON "topics"("community_id");

-- CreateIndex
CREATE INDEX "topics_author_user_id_idx" ON "topics"("author_user_id");

-- CreateIndex
CREATE INDEX "topics_status_idx" ON "topics"("status");

-- CreateIndex
CREATE INDEX "topics_last_reply_at_idx" ON "topics"("last_reply_at");

-- CreateIndex
CREATE INDEX "community_announcements_community_id_idx" ON "community_announcements"("community_id");

-- CreateIndex
CREATE INDEX "polls_community_id_idx" ON "polls"("community_id");

-- CreateIndex
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

-- CreateIndex
CREATE INDEX "poll_votes_poll_option_id_idx" ON "poll_votes"("poll_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_poll_option_id_user_id_key" ON "poll_votes"("poll_option_id", "user_id");

-- CreateIndex
CREATE INDEX "albums_community_id_idx" ON "albums"("community_id");

-- CreateIndex
CREATE INDEX "album_photos_album_id_idx" ON "album_photos"("album_id");

-- CreateIndex
CREATE INDEX "mentor_profiles_is_available_idx" ON "mentor_profiles"("is_available");

-- CreateIndex
CREATE INDEX "mentorships_mentor_user_id_idx" ON "mentorships"("mentor_user_id");

-- CreateIndex
CREATE INDEX "mentorships_mentee_user_id_idx" ON "mentorships"("mentee_user_id");

-- CreateIndex
CREATE INDEX "mentorships_status_idx" ON "mentorships"("status");

-- CreateIndex
CREATE INDEX "mentorship_reviews_mentorship_id_idx" ON "mentorship_reviews"("mentorship_id");

-- CreateIndex
CREATE INDEX "mentorship_reviews_reviewee_user_id_idx" ON "mentorship_reviews"("reviewee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_reviews_mentorship_id_reviewer_user_id_key" ON "mentorship_reviews"("mentorship_id", "reviewer_user_id");

-- CreateIndex
CREATE INDEX "connections_user_a_id_idx" ON "connections"("user_a_id");

-- CreateIndex
CREATE INDEX "connections_user_b_id_idx" ON "connections"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_user_a_id_user_b_id_key" ON "connections"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "connection_requests_from_user_id_idx" ON "connection_requests"("from_user_id");

-- CreateIndex
CREATE INDEX "connection_requests_to_user_id_idx" ON "connection_requests"("to_user_id");

-- CreateIndex
CREATE INDEX "blocks_blocker_user_id_idx" ON "blocks"("blocker_user_id");

-- CreateIndex
CREATE INDEX "blocks_blocked_user_id_idx" ON "blocks"("blocked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_user_id_blocked_user_id_key" ON "blocks"("blocker_user_id", "blocked_user_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversation_members_conversation_id_idx" ON "conversation_members"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_sender_user_id_idx" ON "messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "messages_sent_at_idx" ON "messages"("sent_at");

-- CreateIndex
CREATE INDEX "city_tips_city_id_idx" ON "city_tips"("city_id");

-- CreateIndex
CREATE INDEX "city_tips_author_user_id_idx" ON "city_tips"("author_user_id");

-- CreateIndex
CREATE INDEX "city_tips_kind_idx" ON "city_tips"("kind");

-- CreateIndex
CREATE INDEX "events_organizer_user_id_idx" ON "events"("organizer_user_id");

-- CreateIndex
CREATE INDEX "events_community_id_idx" ON "events"("community_id");

-- CreateIndex
CREATE INDEX "events_type_idx" ON "events"("type");

-- CreateIndex
CREATE INDEX "events_city_id_idx" ON "events"("city_id");

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "event_attendees_event_id_idx" ON "event_attendees"("event_id");

-- CreateIndex
CREATE INDEX "event_attendees_user_id_idx" ON "event_attendees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_event_id_user_id_key" ON "event_attendees"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "housing_listings_author_user_id_idx" ON "housing_listings"("author_user_id");

-- CreateIndex
CREATE INDEX "housing_listings_kind_idx" ON "housing_listings"("kind");

-- CreateIndex
CREATE INDEX "housing_listings_city_id_idx" ON "housing_listings"("city_id");

-- CreateIndex
CREATE INDEX "housing_listings_status_idx" ON "housing_listings"("status");

-- CreateIndex
CREATE INDEX "housing_listings_risk_score_idx" ON "housing_listings"("risk_score");

-- CreateIndex
CREATE INDEX "housing_listings_available_from_idx" ON "housing_listings"("available_from");

-- CreateIndex
CREATE INDEX "housing_photos_listing_id_idx" ON "housing_photos"("listing_id");

-- CreateIndex
CREATE INDEX "job_listings_author_user_id_idx" ON "job_listings"("author_user_id");

-- CreateIndex
CREATE INDEX "job_listings_kind_idx" ON "job_listings"("kind");

-- CreateIndex
CREATE INDEX "job_listings_city_id_idx" ON "job_listings"("city_id");

-- CreateIndex
CREATE INDEX "job_listings_sector_idx" ON "job_listings"("sector");

-- CreateIndex
CREATE INDEX "job_listings_is_sponsored_idx" ON "job_listings"("is_sponsored");

-- CreateIndex
CREATE INDEX "job_listings_status_idx" ON "job_listings"("status");

-- CreateIndex
CREATE INDEX "job_seeker_profiles_is_visible_idx" ON "job_seeker_profiles"("is_visible");

-- CreateIndex
CREATE INDEX "member_recommendations_from_user_id_idx" ON "member_recommendations"("from_user_id");

-- CreateIndex
CREATE INDEX "member_recommendations_to_user_id_idx" ON "member_recommendations"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_recommendations_from_user_id_to_user_id_job_listing__key" ON "member_recommendations"("from_user_id", "to_user_id", "job_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "pro_profiles_user_id_key" ON "pro_profiles"("user_id");

-- CreateIndex
CREATE INDEX "pro_profiles_profession_id_idx" ON "pro_profiles"("profession_id");

-- CreateIndex
CREATE INDEX "pro_profiles_verification_status_idx" ON "pro_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "pro_profiles_tier_idx" ON "pro_profiles"("tier");

-- CreateIndex
CREATE INDEX "pro_profiles_status_idx" ON "pro_profiles"("status");

-- CreateIndex
CREATE INDEX "pro_recommendations_pro_profile_id_idx" ON "pro_recommendations"("pro_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "pro_recommendations_pro_profile_id_author_user_id_key" ON "pro_recommendations"("pro_profile_id", "author_user_id");

-- CreateIndex
CREATE INDEX "pro_contact_logs_pro_profile_id_idx" ON "pro_contact_logs"("pro_profile_id");

-- CreateIndex
CREATE INDEX "pro_contact_logs_user_id_idx" ON "pro_contact_logs"("user_id");

-- CreateIndex
CREATE INDEX "pro_contact_logs_period_key_idx" ON "pro_contact_logs"("period_key");

-- CreateIndex
CREATE INDEX "saved_alerts_user_id_idx" ON "saved_alerts"("user_id");

-- CreateIndex
CREATE INDEX "search_documents_subject_type_idx" ON "search_documents"("subject_type");

-- CreateIndex
CREATE INDEX "search_documents_city_id_idx" ON "search_documents"("city_id");

-- CreateIndex
CREATE INDEX "search_documents_country_id_idx" ON "search_documents"("country_id");

-- CreateIndex
CREATE INDEX "search_documents_community_id_idx" ON "search_documents"("community_id");

-- CreateIndex
CREATE INDEX "search_documents_visibility_idx" ON "search_documents"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_subject_type_subject_id_key" ON "search_documents"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "search_zero_results_query_normalized_idx" ON "search_zero_results"("query_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "search_zero_results_query_normalized_city_id_occurred_on_key" ON "search_zero_results"("query_normalized", "city_id", "occurred_on");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "outbound_messages_channel_idx" ON "outbound_messages"("channel");

-- CreateIndex
CREATE INDEX "outbound_messages_user_id_idx" ON "outbound_messages"("user_id");

-- CreateIndex
CREATE INDEX "outbound_messages_status_idx" ON "outbound_messages"("status");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_idx" ON "reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "reports_subject_id_idx" ON "reports"("subject_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_case_id_idx" ON "reports"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_user_id_subject_type_subject_id_key" ON "reports"("reporter_user_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "moderation_cases_subject_id_idx" ON "moderation_cases"("subject_id");

-- CreateIndex
CREATE INDEX "moderation_cases_subject_author_user_id_idx" ON "moderation_cases"("subject_author_user_id");

-- CreateIndex
CREATE INDEX "moderation_cases_priority_idx" ON "moderation_cases"("priority");

-- CreateIndex
CREATE INDEX "moderation_cases_status_idx" ON "moderation_cases"("status");

-- CreateIndex
CREATE INDEX "moderation_cases_assigned_staff_id_idx" ON "moderation_cases"("assigned_staff_id");

-- CreateIndex
CREATE INDEX "moderation_cases_sla_due_at_idx" ON "moderation_cases"("sla_due_at");

-- CreateIndex
CREATE INDEX "moderation_actions_case_id_idx" ON "moderation_actions"("case_id");

-- CreateIndex
CREATE INDEX "sanctions_user_id_idx" ON "sanctions"("user_id");

-- CreateIndex
CREATE INDEX "scam_alerts_is_pinned_idx" ON "scam_alerts"("is_pinned");

-- CreateIndex
CREATE INDEX "scam_alerts_published_at_idx" ON "scam_alerts"("published_at");

-- CreateIndex
CREATE INDEX "ai_moderation_checks_subject_id_idx" ON "ai_moderation_checks"("subject_id");

-- CreateIndex
CREATE INDEX "ai_moderation_checks_verdict_idx" ON "ai_moderation_checks"("verdict");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_pro_profile_id_idx" ON "subscriptions"("pro_profile_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_number_key" ON "payments"("invoice_number");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "usage_counters_user_id_idx" ON "usage_counters"("user_id");

-- CreateIndex
CREATE INDEX "partners_is_active_idx" ON "partners"("is_active");

-- CreateIndex
CREATE INDEX "partner_placements_partner_id_idx" ON "partner_placements"("partner_id");

-- CreateIndex
CREATE INDEX "partner_placements_step_definition_id_idx" ON "partner_placements"("step_definition_id");

-- CreateIndex
CREATE INDEX "partner_placements_is_active_idx" ON "partner_placements"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "partner_placements_step_definition_id_origin_country_id_des_key" ON "partner_placements"("step_definition_id", "origin_country_id", "destination_country_id");

-- CreateIndex
CREATE INDEX "affiliate_clicks_placement_id_idx" ON "affiliate_clicks"("placement_id");

-- CreateIndex
CREATE INDEX "affiliate_clicks_user_id_idx" ON "affiliate_clicks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_role_idx" ON "staff_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions"("staff_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_target_id_idx" ON "audit_logs"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_slug_key" ON "static_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_user_id_idx" ON "media_assets"("owner_user_id");

-- CreateIndex
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");

-- CreateIndex
CREATE INDEX "domain_events_type_idx" ON "domain_events"("type");

-- CreateIndex
CREATE INDEX "domain_events_published_at_idx" ON "domain_events"("published_at");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "bookmarks_subject_id_idx" ON "bookmarks"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_subject_type_subject_id_key" ON "bookmarks"("user_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "reputation_events_user_id_idx" ON "reputation_events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_events_user_id_type_source_type_source_id_key" ON "reputation_events"("user_id", "type", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_default_city_id_fkey" FOREIGN KEY ("default_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_merged_into_city_id_fkey" FOREIGN KEY ("merged_into_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_template_versions" ADD CONSTRAINT "journey_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "journey_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_template_versions" ADD CONSTRAINT "journey_template_versions_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_template_versions" ADD CONSTRAINT "journey_template_versions_published_by_staff_id_fkey" FOREIGN KEY ("published_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_definitions" ADD CONSTRAINT "step_definitions_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_steps" ADD CONSTRAINT "template_steps_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "journey_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_steps" ADD CONSTRAINT "template_steps_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_dependencies" ADD CONSTRAINT "step_dependencies_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "journey_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_dependencies" ADD CONSTRAINT "step_dependencies_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_dependencies" ADD CONSTRAINT "step_dependencies_depends_on_step_id_fkey" FOREIGN KEY ("depends_on_step_id") REFERENCES "template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "journey_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "journey_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_group_conversation_id_fkey" FOREIGN KEY ("group_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "template_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_step_checklist_items" ADD CONSTRAINT "journey_step_checklist_items_journey_step_id_fkey" FOREIGN KEY ("journey_step_id") REFERENCES "journey_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_members" ADD CONSTRAINT "journey_members_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_members" ADD CONSTRAINT "journey_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_members" ADD CONSTRAINT "journey_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_activities" ADD CONSTRAINT "journey_activities_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_activities" ADD CONSTRAINT "journey_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_activities" ADD CONSTRAINT "journey_activities_journey_step_id_fkey" FOREIGN KEY ("journey_step_id") REFERENCES "journey_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocker_requests" ADD CONSTRAINT "blocker_requests_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocker_requests" ADD CONSTRAINT "blocker_requests_journey_step_id_fkey" FOREIGN KEY ("journey_step_id") REFERENCES "journey_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_correction_proposals" ADD CONSTRAINT "template_correction_proposals_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "journey_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_correction_proposals" ADD CONSTRAINT "template_correction_proposals_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_correction_proposals" ADD CONSTRAINT "template_correction_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_correction_proposals" ADD CONSTRAINT "template_correction_proposals_reviewed_by_staff_id_fkey" FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_journey_step_id_fkey" FOREIGN KEY ("journey_step_id") REFERENCES "journey_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_moved_to_topic_id_fkey" FOREIGN KEY ("moved_to_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_background_asset_id_fkey" FOREIGN KEY ("background_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_reactions" ADD CONSTRAINT "story_reactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_reactions" ADD CONSTRAINT "story_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "guide_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_source_proposal_id_fkey" FOREIGN KEY ("source_proposal_id") REFERENCES "guide_revision_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_votes" ADD CONSTRAINT "guide_votes_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_votes" ADD CONSTRAINT "guide_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_revision_proposals" ADD CONSTRAINT "guide_revision_proposals_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_revision_proposals" ADD CONSTRAINT "guide_revision_proposals_proposer_user_id_fkey" FOREIGN KEY ("proposer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_revision_proposals" ADD CONSTRAINT "guide_revision_proposals_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "guide_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_revision_proposals" ADD CONSTRAINT "guide_revision_proposals_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_revision_proposals" ADD CONSTRAINT "guide_revision_proposals_reviewer_staff_id_fkey" FOREIGN KEY ("reviewer_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_contributors" ADD CONSTRAINT "guide_contributors_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_contributors" ADD CONSTRAINT "guide_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_outdated_flags" ADD CONSTRAINT "guide_outdated_flags_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_outdated_flags" ADD CONSTRAINT "guide_outdated_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_origin_journey_step_id_fkey" FOREIGN KEY ("origin_journey_step_id") REFERENCES "journey_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_origin_blocker_id_fkey" FOREIGN KEY ("origin_blocker_id") REFERENCES "blocker_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_resolved_by_response_id_fkey" FOREIGN KEY ("resolved_by_response_id") REFERENCES "help_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_responses" ADD CONSTRAINT "help_responses_help_request_id_fkey" FOREIGN KEY ("help_request_id") REFERENCES "help_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_responses" ADD CONSTRAINT "help_responses_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_origin_post_id_fkey" FOREIGN KEY ("origin_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_announcements" ADD CONSTRAINT "community_announcements_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_announcements" ADD CONSTRAINT "community_announcements_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_option_id_fkey" FOREIGN KEY ("poll_option_id") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_user_id_fkey" FOREIGN KEY ("mentor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentee_user_id_fkey" FOREIGN KEY ("mentee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_reviews" ADD CONSTRAINT "mentorship_reviews_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_reviews" ADD CONSTRAINT "mentorship_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_reviews" ADD CONSTRAINT "mentorship_reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_tips" ADD CONSTRAINT "city_tips_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_tips" ADD CONSTRAINT "city_tips_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_tips" ADD CONSTRAINT "city_tips_source_story_id_fkey" FOREIGN KEY ("source_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_user_id_fkey" FOREIGN KEY ("organizer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_listings" ADD CONSTRAINT "housing_listings_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_listings" ADD CONSTRAINT "housing_listings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_photos" ADD CONSTRAINT "housing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "housing_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housing_photos" ADD CONSTRAINT "housing_photos_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_seeker_profiles" ADD CONSTRAINT "job_seeker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_recommendations" ADD CONSTRAINT "member_recommendations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_recommendations" ADD CONSTRAINT "member_recommendations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_recommendations" ADD CONSTRAINT "member_recommendations_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_profession_id_fkey" FOREIGN KEY ("profession_id") REFERENCES "professions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_proof_asset_id_fkey" FOREIGN KEY ("proof_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profile_cities" ADD CONSTRAINT "pro_profile_cities_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_profile_cities" ADD CONSTRAINT "pro_profile_cities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_recommendations" ADD CONSTRAINT "pro_recommendations_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_recommendations" ADD CONSTRAINT "pro_recommendations_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_recommendations" ADD CONSTRAINT "pro_recommendations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_contact_logs" ADD CONSTRAINT "pro_contact_logs_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_contact_logs" ADD CONSTRAINT "pro_contact_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_alerts" ADD CONSTRAINT "saved_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_zero_results" ADD CONSTRAINT "search_zero_results_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_subject_author_user_id_fkey" FOREIGN KEY ("subject_author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_issued_by_staff_id_fkey" FOREIGN KEY ("issued_by_staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scam_alerts" ADD CONSTRAINT "scam_alerts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scam_alerts" ADD CONSTRAINT "scam_alerts_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scam_alerts" ADD CONSTRAINT "scam_alerts_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scam_alerts" ADD CONSTRAINT "scam_alerts_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pro_profile_id_fkey" FOREIGN KEY ("pro_profile_id") REFERENCES "pro_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_asset_id_fkey" FOREIGN KEY ("invoice_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_asset_id_fkey" FOREIGN KEY ("logo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_placements" ADD CONSTRAINT "partner_placements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_placements" ADD CONSTRAINT "partner_placements_step_definition_id_fkey" FOREIGN KEY ("step_definition_id") REFERENCES "step_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_placements" ADD CONSTRAINT "partner_placements_origin_country_id_fkey" FOREIGN KEY ("origin_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_placements" ADD CONSTRAINT "partner_placements_destination_country_id_fkey" FOREIGN KEY ("destination_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "partner_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_journey_step_id_fkey" FOREIGN KEY ("journey_step_id") REFERENCES "journey_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_pages" ADD CONSTRAINT "static_pages_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
