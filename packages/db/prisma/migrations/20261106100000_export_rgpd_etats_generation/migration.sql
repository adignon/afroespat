-- Export RGPD : une vraie prise de la demande (GENERATING) et un état d'échec redemandable (FAILED).
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'GENERATING';
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'FAILED';
