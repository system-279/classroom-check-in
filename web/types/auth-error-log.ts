export type AuthErrorLog = {
  id: string;
  email: string;
  tenantId: string;
  errorType: string;
  errorMessage: string;
  path: string;
  method: string;
  userAgent: string | null;
  ipAddress: string | null;
  occurredAt: string;
};
