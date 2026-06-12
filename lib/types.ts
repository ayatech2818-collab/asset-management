// Domain types for the Asset Management System.
// These are hand-written for now; once a live Supabase project exists they can
// be regenerated with `supabase gen types typescript`.

export type Role = "admin" | "asset_manager" | "employee";

export type AssetStatus =
  | "in_stock"
  | "assigned"
  | "pending_acceptance"
  | "under_repair"
  | "retired"
  | "lost";

export type AssetCategory =
  | "laptop"
  | "mobile"
  | "monitor"
  | "vehicle"
  | "furniture"
  | "tool"
  | "other";

export type AssetCondition = "new" | "good" | "fair" | "damaged";

export type TransferType = "issue" | "transfer" | "return";
export type TransferStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type AlertSeverity = "low" | "med" | "high";
export type AlertStatus = "active" | "resolved";

export interface Profile {
  id: string;
  employee_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  vendor: string | null;
  warranty_expiry: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  current_custodian: string | null;
  location: string | null;
  is_monitored: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustodyRecord {
  id: string;
  asset_id: string;
  custodian_id: string;
  issued_by: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  condition_out: string | null;
  condition_in: string | null;
  remarks: string | null;
}

export interface Transfer {
  id: string;
  asset_id: string;
  type: TransferType;
  from_custodian: string | null;
  to_custodian: string | null;
  initiated_by: string;
  status: TransferStatus;
  reason: string | null;
  remarks: string | null;
  requested_at: string;
  responded_at: string | null;
}

export interface Alert {
  id: string;
  asset_id: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type Platform = "windows" | "mac" | "android" | "ios";
export type OnlineStatus = "online" | "offline";

export interface DeviceEnrollment {
  id: string;
  asset_id: string;
  device_token: string;
  platform: Platform;
  agent_version: string | null;
  enrolled_at: string;
  last_seen: string | null;
  online_status: OnlineStatus;
  is_active: boolean;
  // Tier 1 device facts (refreshed each heartbeat).
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  os_name: string | null;
  os_version: string | null;
  total_ram_gb: number | null;
  total_disk_gb: number | null;
  mac_address: string | null;
  wifi_ssid: string | null;
  local_ip: string | null;
  disk_encrypted: boolean | null;
  antivirus: string | null;
  battery_health: string | null;
}

export interface Heartbeat {
  id: number;
  asset_id: string;
  reported_at: string;
  hostname: string | null;
  logged_in_user: string | null;
  public_ip: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  loc_accuracy_m: number | null;
  loc_source: string | null;
  idle_minutes: number | null;
  uptime_minutes: number | null;
  battery_pct: number | null;
  is_charging: boolean | null;
  disk_free_gb: number | null;
  cpu_pct: number | null;
  ram_pct: number | null;
  screen_on_minutes: number | null;
  unlock_count: number | null;
}

// Role helpers — kept here (not in the server-only DAL) so client components
// can use them too.
export const STAFF_ROLES: Role[] = ["admin", "asset_manager"];

export function isStaff(role: Role | undefined | null): boolean {
  return role === "admin" || role === "asset_manager";
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin";
}
