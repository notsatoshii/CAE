/**
 * /build/admin/roles — Role whitelist viewer (admin-only).
 *
 * Server component: reads ADMIN_EMAILS + OPERATOR_EMAILS from env at
 * request time. Middleware already gates this page to admin role.
 *
 * Phase 14 Plan 04: v0.1 read-only. v2 will add editable UI + DB adapter.
 */
import { parseList } from "@/lib/cae-rbac"
import { RoleEditor } from "./role-editor"

export const dynamic = "force-dynamic"

export default function RolesPage() {
  const admins = parseList(process.env.ADMIN_EMAILS)
  const operators = parseList(process.env.OPERATOR_EMAILS)
  return <RoleEditor admins={admins} operators={operators} />
}
