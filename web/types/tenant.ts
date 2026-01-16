/**
 * テナント関連の型定義
 */

export type TenantStatus = "active" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  ownerEmail: string;
  status: TenantStatus;
  createdAt: string | null;
}

export interface CreateTenantRequest {
  name: string;
}

export interface CreateTenantResponse {
  tenant: Tenant;
  adminUrl: string;
}

export interface MyTenantsResponse {
  tenants: Tenant[];
}
