// GÉNÉRÉ depuis packages/db/prisma/schema/*.prisma — ne pas modifier à la main.
// Régénérer : pnpm --filter @app/shared generate
//
// 95 enums, 16 fichiers de schéma.

/** Module 13-moderation. */
export const AiVerdict = [
  'ALLOW',
  'QUEUE',
  'BLOCK',
] as const;
export type AiVerdict = (typeof AiVerdict)[number];

/** Module 10-services. */
export const AlertKind = [
  'HOUSING',
  'JOB',
] as const;
export type AlertKind = (typeof AlertKind)[number];

/** Module 09-cities-events. */
export const AttendeeStatus = [
  'GOING',
  'MAYBE',
  'DECLINED',
  'WAITLIST',
] as const;
export type AttendeeStatus = (typeof AttendeeStatus)[number];

/** Module 15-administration. */
export const AuditActorType = [
  'STAFF',
  'SYSTEM',
  'MEMBER',
] as const;
export type AuditActorType = (typeof AuditActorType)[number];

/** Module 03-journeys. */
export const BlockerStatus = [
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
] as const;
export type BlockerStatus = (typeof BlockerStatus)[number];

/** Module 03-journeys. */
export const BlockerTarget = [
  'HELP',
  'HOUSING',
  'JOBS',
  'MENTORSHIP',
  'NONE',
] as const;
export type BlockerTarget = (typeof BlockerTarget)[number];

/** Module t-transverse. */
export const BookmarkState = [
  'AVAILABLE',
  'EXPIRED',
  'RESOLVED',
  'PAST',
  'UNAVAILABLE',
  'UPDATED',
  'REMOVED',
] as const;
export type BookmarkState = (typeof BookmarkState)[number];

/** Module t-transverse. */
export const BookmarkSubjectType = [
  'STORY',
  'GUIDE',
  'POST',
  'HELP_REQUEST',
  'EVENT',
  'HOUSING',
  'JOB',
  'PRO',
  'MENTOR',
  'USER',
  'TOPIC',
  'CITY',
] as const;
export type BookmarkSubjectType = (typeof BookmarkSubjectType)[number];

/** Module 09-cities-events. */
export const CityTipKind = [
  'TIP',
  'SHOP',
  'BUDGET',
  'TESTIMONY',
] as const;
export type CityTipKind = (typeof CityTipKind)[number];

/** Module 04-feed. */
export const CommentSubjectType = [
  'POST',
  'TOPIC',
  'GUIDE',
  'EVENT',
] as const;
export type CommentSubjectType = (typeof CommentSubjectType)[number];

/** Module 07-communities. */
export const CommunityKind = [
  'CITY',
  'COUNTRY',
  'INTEREST',
] as const;
export type CommunityKind = (typeof CommunityKind)[number];

/** Module 07-communities. */
export const CommunityMemberRole = [
  'OWNER',
  'MODERATOR',
  'MEMBER',
] as const;
export type CommunityMemberRole = (typeof CommunityMemberRole)[number];

/** Module 07-communities. */
export const CommunityMemberStatus = [
  'ACTIVE',
  'PENDING',
  'INVITED',
  'BANNED',
] as const;
export type CommunityMemberStatus = (typeof CommunityMemberStatus)[number];

/** Module 07-communities. */
export const CommunityStatus = [
  'ACTIVE',
  'ARCHIVED',
] as const;
export type CommunityStatus = (typeof CommunityStatus)[number];

/** Module 07-communities. */
export const CommunityVisibility = [
  'PUBLIC',
  'ON_REQUEST',
  'INVITE_ONLY',
] as const;
export type CommunityVisibility = (typeof CommunityVisibility)[number];

/** Module 08-mentorship-messaging. */
export const ConnectionOrigin = [
  'HELP_VALIDATED',
  'MENTORSHIP',
  'EVENT',
  'GUIDE',
  'MANUAL',
] as const;
export type ConnectionOrigin = (typeof ConnectionOrigin)[number];

/** Module 08-mentorship-messaging. */
export const ConnectionRequestStatus = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
] as const;
export type ConnectionRequestStatus = (typeof ConnectionRequestStatus)[number];

/** Module 01-identity. */
export const ConsentType = [
  'TERMS',
  'PRIVACY',
  'MARKETING_EMAIL',
  'JOURNEY_VISIBILITY',
] as const;
export type ConsentType = (typeof ConsentType)[number];

/** Module 04-feed. */
export const ContentStatus = [
  'PUBLISHED',
  'HIDDEN',
  'REMOVED',
] as const;
export type ContentStatus = (typeof ContentStatus)[number];

/** Module 08-mentorship-messaging. */
export const ConversationKind = [
  'DIRECT',
  'JOURNEY',
  'MENTORSHIP',
] as const;
export type ConversationKind = (typeof ConversationKind)[number];

/** Module 03-journeys. */
export const CorrectionProposalStatus = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
] as const;
export type CorrectionProposalStatus = (typeof CorrectionProposalStatus)[number];

/** Module 02-referentials. */
export const CountryKind = [
  'ORIGIN',
  'DESTINATION',
  'BOTH',
] as const;
export type CountryKind = (typeof CountryKind)[number];

/** Module 01-identity. */
export const DataExportStatus = [
  'PENDING',
  'READY',
  'EXPIRED',
] as const;
export type DataExportStatus = (typeof DataExportStatus)[number];

/** Module 09-cities-events. */
export const EventStatus = [
  'SCHEDULED',
  'CANCELLED',
  'DONE',
] as const;
export type EventStatus = (typeof EventStatus)[number];

/** Module 09-cities-events. */
export const EventType = [
  'PICNIC',
  'SPORT',
  'CV_WORKSHOP',
  'COOKING',
  'NETWORKING',
  'OUTING',
  'CONFERENCE',
  'OTHER',
] as const;
export type EventType = (typeof EventType)[number];

/** Module 05-guides. */
export const GuideCategory = [
  'PRE_DEPARTURE',
  'ARRIVAL',
  'HOUSING',
  'DAILY_LIFE',
  'WORK_STUDIES',
  'SCAM_ALERTS',
] as const;
export type GuideCategory = (typeof GuideCategory)[number];

/** Module 05-guides. */
export const GuideProposalStatus = [
  'PENDING',
  'ACCEPTED',
  'AMENDED',
  'REJECTED',
  'ESCALATED',
] as const;
export type GuideProposalStatus = (typeof GuideProposalStatus)[number];

/** Module 05-guides. */
export const GuideScope = [
  'UNIVERSAL',
  'COUNTRY',
] as const;
export type GuideScope = (typeof GuideScope)[number];

/** Module 05-guides. */
export const GuideStatus = [
  'DRAFT',
  'PUBLISHED',
  'FLAGGED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;
export type GuideStatus = (typeof GuideStatus)[number];

/** Module 05-guides. */
export const GuideVoteValue = [
  'HELPFUL',
  'NOT_HELPFUL',
] as const;
export type GuideVoteValue = (typeof GuideVoteValue)[number];

/** Module 06-help. */
export const HelpKind = [
  'REQUEST',
  'OFFER',
] as const;
export type HelpKind = (typeof HelpKind)[number];

/** Module 06-help. */
export const HelpStatus = [
  'OPEN',
  'RESOLVED',
  'ARCHIVED',
] as const;
export type HelpStatus = (typeof HelpStatus)[number];

/** Module 01-identity. */
export const HelpType = [
  'PAPERWORK',
  'HOUSING',
  'JOB',
  'WELCOME',
  'SERVICE',
  'RIDE',
  'MATERIAL',
  'OTHER',
] as const;
export type HelpType = (typeof HelpType)[number];

/** Module 10-services. */
export const HousingKind = [
  'RENT',
  'FLATSHARE',
  'SUBLET',
  'TEMPORARY',
  'SEEKING_HOUSING',
  'SEEKING_FLATMATE',
] as const;
export type HousingKind = (typeof HousingKind)[number];

/** Module 10-services. */
export const HousingStatus = [
  'ACTIVE',
  'PAUSED',
  'TAKEN',
  'EXPIRED',
  'REMOVED',
] as const;
export type HousingStatus = (typeof HousingStatus)[number];

/** Module 10-services. */
export const JobKind = [
  'JOB',
  'INTERNSHIP',
  'APPRENTICESHIP',
  'GIG',
] as const;
export type JobKind = (typeof JobKind)[number];

/** Module 10-services. */
export const JobStatus = [
  'ACTIVE',
  'EXPIRED',
  'REMOVED',
] as const;
export type JobStatus = (typeof JobStatus)[number];

/** Module 03-journeys. */
export const JourneyActivityType = [
  'STEP_STARTED',
  'STEP_DONE',
  'STEP_PAUSED',
  'BLOCKER_PUBLISHED',
  'HELP_RECEIVED',
  'MEMBER_JOINED',
  'MILESTONE_SHARED',
  'NOTE',
] as const;
export type JourneyActivityType = (typeof JourneyActivityType)[number];

/** Module 03-journeys. */
export const JourneyMemberRole = [
  'OBSERVER',
  'SUPPORTER',
] as const;
export type JourneyMemberRole = (typeof JourneyMemberRole)[number];

/** Module 03-journeys. */
export const JourneyMemberStatus = [
  'INVITED',
  'ACTIVE',
  'REMOVED',
] as const;
export type JourneyMemberStatus = (typeof JourneyMemberStatus)[number];

/** Module 03-journeys. */
export const JourneyStatus = [
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ABANDONED',
  'ARCHIVED',
] as const;
export type JourneyStatus = (typeof JourneyStatus)[number];

/** Module 03-journeys. */
export const JourneyStepStatus = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'PAUSED',
] as const;
export type JourneyStepStatus = (typeof JourneyStepStatus)[number];

/** Module 03-journeys. */
export const JourneyVisibility = [
  'PRIVATE',
  'SHARED',
  'PUBLIC',
] as const;
export type JourneyVisibility = (typeof JourneyVisibility)[number];

/** Module 01-identity. */
export const KycProvider = [
  'DIDIT',
] as const;
export type KycProvider = (typeof KycProvider)[number];

/** Module 01-identity. */
export const KycStatus = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'APPROVED',
  'DECLINED',
  'IN_REVIEW',
  'ABANDONED',
  'EXPIRED',
] as const;
export type KycStatus = (typeof KycStatus)[number];

/** Module t-transverse. */
export const MediaKind = [
  'AVATAR',
  'POST',
  'HOUSING',
  'EVENT_COVER',
  'ALBUM',
  'MESSAGE',
  'PROOF',
  'LOGO',
  'EXPORT',
  'INVOICE',
] as const;
export type MediaKind = (typeof MediaKind)[number];

/** Module t-transverse. */
export const MediaStatus = [
  'PENDING',
  'SCANNING',
  'READY',
  'REJECTED',
] as const;
export type MediaStatus = (typeof MediaStatus)[number];

/** Module 08-mentorship-messaging. */
export const MentorshipEndReason = [
  'COMPLETED',
  'MENTOR_LEFT',
  'MENTEE_LEFT',
  'BLOCKED',
  'ADMIN',
] as const;
export type MentorshipEndReason = (typeof MentorshipEndReason)[number];

/** Module 08-mentorship-messaging. */
export const MentorshipStatus = [
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'ACTIVE',
  'ENDED',
  'CANCELLED',
] as const;
export type MentorshipStatus = (typeof MentorshipStatus)[number];

/** Module 13-moderation. */
export const ModerationActionType = [
  'HIDE',
  'UNHIDE',
  'REMOVE',
  'WARN',
  'SUSPEND_USER',
  'BAN_USER',
  'DISMISS',
  'NOTE',
] as const;
export type ModerationActionType = (typeof ModerationActionType)[number];

/** Module 13-moderation. */
export const ModerationCaseStatus = [
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
] as const;
export type ModerationCaseStatus = (typeof ModerationCaseStatus)[number];

/** Module 13-moderation. */
export const ModerationResolution = [
  'KEEP',
  'HIDE',
  'REMOVE',
  'WARN',
  'SUSPEND',
] as const;
export type ModerationResolution = (typeof ModerationResolution)[number];

/** Module 13-moderation. */
export const ModerationSource = [
  'REPORT',
  'AI',
  'RISK_SCORE',
  'AUTO_RULE',
] as const;
export type ModerationSource = (typeof ModerationSource)[number];

/** Module 04-feed. */
export const ModerationStatus = [
  'PENDING',
  'CLEARED',
  'FLAGGED',
] as const;
export type ModerationStatus = (typeof ModerationStatus)[number];

/** Module 11-12-search-notifications. */
export const NotificationChannel = [
  'EMAIL',
  'SMS',
  'PUSH',
] as const;
export type NotificationChannel = (typeof NotificationChannel)[number];

/** Module 01-identity. */
export const OccupationStatus = [
  'STUDENT',
  'EMPLOYEE',
  'ENTREPRENEUR',
  'JOB_SEEKER',
  'OTHER',
] as const;
export type OccupationStatus = (typeof OccupationStatus)[number];

/** Module 01-identity. */
export const OtpPurpose = [
  'SIGNUP',
  'LOGIN',
  'ADD_PHONE',
  'DELETE_ACCOUNT',
  'REACTIVATE',
] as const;
export type OtpPurpose = (typeof OtpPurpose)[number];

/** Module 11-12-search-notifications. */
export const OutboundStatus = [
  'QUEUED',
  'SENT',
  'FAILED',
  'BOUNCED',
] as const;
export type OutboundStatus = (typeof OutboundStatus)[number];

/** Module 14-monetisation. */
export const PartnerCategory = [
  'INSURANCE',
  'AIRLINE',
  'BANK',
  'REMITTANCE',
  'HOUSING_GUARANTEE',
  'TELECOM',
  'OTHER',
] as const;
export type PartnerCategory = (typeof PartnerCategory)[number];

/** Module 14-monetisation. */
export const PaymentMethodKind = [
  'CARD',
  'MTN_MOMO',
  'MOOV_MONEY',
] as const;
export type PaymentMethodKind = (typeof PaymentMethodKind)[number];

/** Module 14-monetisation. */
export const PaymentProviderKind = [
  'STRIPE',
  'MOBILE_MONEY',
] as const;
export type PaymentProviderKind = (typeof PaymentProviderKind)[number];

/** Module 14-monetisation. */
export const PaymentStatus = [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PaymentStatus)[number];

/** Module 14-monetisation. */
export const PayoutModel = [
  'CPA',
  'CPC',
  'FLAT',
] as const;
export type PayoutModel = (typeof PayoutModel)[number];

/** Module 01-identity. */
export const Phase = [
  'PRE_DEPARTURE',
  'RECENT_ARRIVAL',
  'SETTLED',
] as const;
export type Phase = (typeof Phase)[number];

/** Module 14-monetisation. */
export const PlanCode = [
  'FREE',
  'PREMIUM',
  'PRO',
  'PRO_PLUS',
] as const;
export type PlanCode = (typeof PlanCode)[number];

/** Module 14-monetisation. */
export const PlanInterval = [
  'MONTH',
  'YEAR',
] as const;
export type PlanInterval = (typeof PlanInterval)[number];

/** Module 04-feed. */
export const PostType = [
  'VICTORY',
  'QUESTION',
  'INFO',
  'DISCUSSION',
] as const;
export type PostType = (typeof PostType)[number];

/** Module 10-services. */
export const ProContactMethod = [
  'PLATFORM_MESSAGE',
  'EMAIL',
  'PHONE_ON_REQUEST',
] as const;
export type ProContactMethod = (typeof ProContactMethod)[number];

/** Module 10-services. */
export const ProStatus = [
  'ACTIVE',
  'PAUSED',
  'REMOVED',
] as const;
export type ProStatus = (typeof ProStatus)[number];

/** Module 10-services. */
export const ProTier = [
  'FREE',
  'PRO',
  'PRO_PLUS',
] as const;
export type ProTier = (typeof ProTier)[number];

/** Module 10-services. */
export const ProVerificationStatus = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;
export type ProVerificationStatus = (typeof ProVerificationStatus)[number];

/** Module 04-feed. */
export const ReactionKind = [
  'BRAVO',
  'USEFUL',
  'SUPPORT',
  'LIKE',
] as const;
export type ReactionKind = (typeof ReactionKind)[number];

/** Module 13-moderation. */
export const ReportReason = [
  'SCAM',
  'MONEY_REQUEST',
  'HARASSMENT',
  'SPAM',
  'INAPPROPRIATE',
  'OTHER',
] as const;
export type ReportReason = (typeof ReportReason)[number];

/** Module 13-moderation. */
export const ReportStatus = [
  'NEW',
  'ATTACHED',
  'RESOLVED',
  'DISMISSED',
] as const;
export type ReportStatus = (typeof ReportStatus)[number];

/** Module 13-moderation. */
export const ReportSubjectType = [
  'POST',
  'COMMENT',
  'TOPIC',
  'GUIDE',
  'HELP_REQUEST',
  'HELP_RESPONSE',
  'HOUSING',
  'JOB',
  'PRO',
  'EVENT',
  'MESSAGE',
  'USER',
] as const;
export type ReportSubjectType = (typeof ReportSubjectType)[number];

/** Module t-transverse. */
export const ReputationEventType = [
  'HELP_VALIDATED',
  'GUIDE_HELPFUL_VOTE',
  'GUIDE_CONTRIBUTION',
  'MENTORSHIP_COMPLETED',
  'EVENT_ORGANIZED',
] as const;
export type ReputationEventType = (typeof ReputationEventType)[number];

/** Module 13-moderation. */
export const SanctionType = [
  'WARNING',
  'SUSPENSION',
  'BAN',
] as const;
export type SanctionType = (typeof SanctionType)[number];

/** Module 13-moderation. */
export const ScamAlertSeverity = [
  'INFO',
  'WARNING',
  'CRITICAL',
] as const;
export type ScamAlertSeverity = (typeof ScamAlertSeverity)[number];

/** Module 11-12-search-notifications. */
export const SearchSubjectType = [
  'GUIDE',
  'TOPIC',
  'HELP_REQUEST',
  'HOUSING',
  'JOB',
  'EVENT',
  'USER',
  'CITY',
  'PRO',
] as const;
export type SearchSubjectType = (typeof SearchSubjectType)[number];

/** Module 11-12-search-notifications. */
export const SearchVisibility = [
  'PUBLIC',
  'COMMUNITY',
  'NONE',
] as const;
export type SearchVisibility = (typeof SearchVisibility)[number];

/** Module 15-administration. */
export const StaffRole = [
  'SUPER_ADMIN',
  'CONTENT_ADMIN',
  'MODERATOR',
  'SUPPORT',
] as const;
export type StaffRole = (typeof StaffRole)[number];

/** Module 03-journeys. */
export const StepCategory = [
  'PRE_DEPARTURE',
  'ARRIVAL',
  'SETTLEMENT',
] as const;
export type StepCategory = (typeof StepCategory)[number];

/** Module 04-feed. */
export const StoryAudience = [
  'ALL',
  'CITY',
] as const;
export type StoryAudience = (typeof StoryAudience)[number];

/** Module 04-feed. */
export const StoryReactionKind = [
  'USEFUL',
  'NOT_USEFUL',
  'WANT_TO_GO',
  'BEEN_THERE',
  'CONFIRM',
  'CHANGED',
] as const;
export type StoryReactionKind = (typeof StoryReactionKind)[number];

/** Module 04-feed. */
export const StoryStatus = [
  'ACTIVE',
  'EXPIRED',
  'HIDDEN',
  'REMOVED',
] as const;
export type StoryStatus = (typeof StoryStatus)[number];

/** Module 04-feed. */
export const StoryTextStyle = [
  'BOLD',
  'SERIF',
  'MONO',
] as const;
export type StoryTextStyle = (typeof StoryTextStyle)[number];

/** Module 04-feed. */
export const StoryType = [
  'CONSEIL',
  'DECOUVERTE',
  'INFORMATION',
] as const;
export type StoryType = (typeof StoryType)[number];

/** Module 14-monetisation. */
export const SubscriptionStatus = [
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
] as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[number];

/** Module 03-journeys. */
export const TemplateVersionStatus = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type TemplateVersionStatus = (typeof TemplateVersionStatus)[number];

/** Module 07-communities. */
export const TopicPinKind = [
  'NONE',
  'RULES',
  'RESOURCE',
  'WELCOME',
] as const;
export type TopicPinKind = (typeof TopicPinKind)[number];

/** Module 07-communities. */
export const TopicStatus = [
  'OPEN',
  'RESOLVED',
  'ARCHIVED',
] as const;
export type TopicStatus = (typeof TopicStatus)[number];

/** Module 14-monetisation. */
export const UsageMetric = [
  'EVENTS_CREATED',
  'PRO_CONTACTS',
] as const;
export type UsageMetric = (typeof UsageMetric)[number];

/** Module 01-identity. */
export const UserPlan = [
  'FREE',
  'PREMIUM',
] as const;
export type UserPlan = (typeof UserPlan)[number];

/** Module 01-identity. */
export const UserStatus = [
  'ACTIVE',
  'DEACTIVATED',
  'SUSPENDED',
  'DELETION_PENDING',
  'DELETED',
] as const;
export type UserStatus = (typeof UserStatus)[number];

/** Module 01-identity. */
export const VerificationLevel = [
  'L0',
  'L1',
  'L2',
] as const;
export type VerificationLevel = (typeof VerificationLevel)[number];

/** Toutes les listes de valeurs, indexées par nom d’enum. */
export const ALL_ENUMS = {
  AiVerdict,
  AlertKind,
  AttendeeStatus,
  AuditActorType,
  BlockerStatus,
  BlockerTarget,
  BookmarkState,
  BookmarkSubjectType,
  CityTipKind,
  CommentSubjectType,
  CommunityKind,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
  CommunityVisibility,
  ConnectionOrigin,
  ConnectionRequestStatus,
  ConsentType,
  ContentStatus,
  ConversationKind,
  CorrectionProposalStatus,
  CountryKind,
  DataExportStatus,
  EventStatus,
  EventType,
  GuideCategory,
  GuideProposalStatus,
  GuideScope,
  GuideStatus,
  GuideVoteValue,
  HelpKind,
  HelpStatus,
  HelpType,
  HousingKind,
  HousingStatus,
  JobKind,
  JobStatus,
  JourneyActivityType,
  JourneyMemberRole,
  JourneyMemberStatus,
  JourneyStatus,
  JourneyStepStatus,
  JourneyVisibility,
  KycProvider,
  KycStatus,
  MediaKind,
  MediaStatus,
  MentorshipEndReason,
  MentorshipStatus,
  ModerationActionType,
  ModerationCaseStatus,
  ModerationResolution,
  ModerationSource,
  ModerationStatus,
  NotificationChannel,
  OccupationStatus,
  OtpPurpose,
  OutboundStatus,
  PartnerCategory,
  PaymentMethodKind,
  PaymentProviderKind,
  PaymentStatus,
  PayoutModel,
  Phase,
  PlanCode,
  PlanInterval,
  PostType,
  ProContactMethod,
  ProStatus,
  ProTier,
  ProVerificationStatus,
  ReactionKind,
  ReportReason,
  ReportStatus,
  ReportSubjectType,
  ReputationEventType,
  SanctionType,
  ScamAlertSeverity,
  SearchSubjectType,
  SearchVisibility,
  StaffRole,
  StepCategory,
  StoryAudience,
  StoryReactionKind,
  StoryStatus,
  StoryTextStyle,
  StoryType,
  SubscriptionStatus,
  TemplateVersionStatus,
  TopicPinKind,
  TopicStatus,
  UsageMetric,
  UserPlan,
  UserStatus,
  VerificationLevel,
} as const;
