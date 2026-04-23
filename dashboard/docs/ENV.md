# Environment Variables

## Required (all environments)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `AUTH_SECRET` | NextAuth signing secret for JWT + session cookies | `openssl rand -hex 32` |
| `AUTH_GITHUB_ID` | GitHub OAuth app client ID | https://github.com/settings/developers → New OAuth App |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app client secret | Same as above |
| `AUTH_GOOGLE_ID` | Google OAuth 2.0 client ID (Phase 14) | https://console.cloud.google.com/apis/credentials |
| `AUTH_GOOGLE_SECRET` | Google OAuth 2.0 client secret (Phase 14) | Same as above |
| `ADMIN_EMAILS` | Comma-separated admin email addresses (Phase 14 RBAC) | Set to your own email, e.g. `eric@diiant.com` |
| `OPERATOR_EMAILS` | Comma-separated operator email addresses (Phase 14 RBAC) | e.g. `ops@diiant.com,contractor@example.com` |

## Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `AUTH_URL` | NextAuth base URL (needed in some deploy environments) | Inferred from request |
| `AUTH_GOOGLE_HOSTED_DOMAIN` | Google Workspace domain lock. When set, the `signIn` callback in `auth.ts` enforces three checks server-side: `email_verified=true`, `hd` claim equals this domain, and email ends with `@<domain>`. All three must pass or sign-in is rejected. Note: the `hd` OAuth URL param sent to Google is a UX hint only (pre-selects account chooser) — the actual security gate is the server-side `signIn` callback. E.g. `diiant.com`. | Unset (any Google account allowed) |
| `SHIFT_PROJECTS_HOME` | Root directory scanned for Shift-managed projects | `/home/cae` |
| `CAE_ROOT` | Root path for buildplan path validation and runtime state files (scheduled_tasks.json, .cae/) | `/home/cae/ctrl-alt-elite` |
| `CAE_SKILLS_DIR` | Override for the local skills directory (used in tests for isolation) | `~/.claude/skills` |
| `GITLEAKS_VERSION` | Pin gitleaks version for `scripts/install-gitleaks.sh` | `8.18.4` |
| `ANTHROPIC_API_KEY` | Required only if NL scheduler LLM fallback is triggered (non-rule phrases) | Not set — rule parser handles 80%+ of phrases without it |

## Role assignment (Phase 14 RBAC)

Roles are resolved at JWT creation time (i.e. when a user first signs in):

1. If the user's email is in `ADMIN_EMAILS` → `admin` role.
2. If the user's email is in `OPERATOR_EMAILS` → `operator` role.
3. Otherwise → `viewer` role (read-only).

Whitelist entries are case-insensitive and leading/trailing whitespace is trimmed.

**To change a user's role:** edit `.env.local` and restart the dev server (or redeploy). The new role takes effect on the user's next sign-in.

## Google Cloud Console setup

1. Go to https://console.cloud.google.com/apis/credentials
2. Create **OAuth 2.0 Client ID** → Web application.
3. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://your-production-domain.com/api/auth/callback/google`
4. Copy **Client ID** → `AUTH_GOOGLE_ID`
5. Copy **Client Secret** → `AUTH_GOOGLE_SECRET`
6. Add both to `.env.local` (never commit this file).

## GitHub OAuth App setup

1. Go to https://github.com/settings/developers → OAuth Apps → New OAuth App.
2. Set **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Copy **Client ID** → `AUTH_GITHUB_ID`
4. Generate + copy **Client Secret** → `AUTH_GITHUB_SECRET`

## Example `.env.local`

```bash
AUTH_SECRET=<output of `openssl rand -hex 32`>

AUTH_GITHUB_ID=Ov23liXXXXXXXXXX
AUTH_GITHUB_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

AUTH_GOOGLE_ID=XXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

ADMIN_EMAILS=eric@diiant.com
OPERATOR_EMAILS=ops@diiant.com

# Optional — lock Google SSO to @diiant.com workspace only (enforced server-side):
# AUTH_GOOGLE_HOSTED_DOMAIN=diiant.com

# Optional — override runtime state root:
# CAE_ROOT=/home/cae/ctrl-alt-elite

# Optional — gitleaks version for install script:
# GITLEAKS_VERSION=8.18.4
```
