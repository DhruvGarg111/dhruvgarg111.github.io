---
name: github-security-alerts
description: Fetch and summarize GitHub security/Dependabot alerts via gh API when UI access is limited.
version: 1.0.0
metadata:
  hermes:
    tags: [github, security, dependabot, alerts]
    category: github
---

# GitHub Security Alerts (Dependabot)

## When to Use
- User asks to check/summary Dependabot alerts for a repo
- GitHub UI shows 404 due to auth/permissions but you still need data
- You need a reproducible, compact alert summary

## Prerequisites
- `gh auth status -h github.com` succeeds with `repo` scope
- Repo is accessible to the authenticated user

## Procedure
1) **Verify auth**
   ```bash
   gh auth status -h github.com
   ```

2) **Fetch alerts via API (paginate)**
   Prefer a `--template` output to avoid gigantic JSON parsing issues.
   ```bash
   gh api -H 'Accept: application/vnd.github+json' \
     /repos/<org>/<repo>/dependabot/alerts --paginate \
     --template '{{range .}}{{.number}}\t{{.state}}\t{{.security_vulnerability.severity}}\t{{.dependency.package.name}}\t{{.dependency.manifest_path}}\t{{.dependency.scope}}\t{{.dependency.relationship}}\t{{.security_vulnerability.vulnerable_version_range}}\t{{if .security_vulnerability.first_patched_version}}{{.security_vulnerability.first_patched_version.identifier}}{{end}}\t{{.security_advisory.ghsa_id}}\t{{.security_advisory.cve_id}}\t{{.security_advisory.summary}}\n{{end}}'
   ```

3) **Summarize**
   - Count by severity (high/medium/low)
   - Group by package name to identify hotspots
   - Provide direct alert URLs: `https://github.com/<org>/<repo>/security/dependabot/<number>`

4) **Explain fixes**
   - For each alert: mention fixed version (`first_patched_version`)
   - If package is transitive, advise upgrading the parent or pinning a safe minimum

## Pitfalls
- The raw JSON is often huge; direct parsing can fail. Use `--template` or NDJSON output.
- GitHub UI 404 often means permission or not logged in. The API may still work with proper auth.
- Dependabot alerts are only available to users with proper repo access.

## Verification
- `TOTAL_ALERTS` matches the number of alert lines emitted by the template output.
- Randomly open one alert URL to confirm availability.

## References
- `references/dependabot-alerts-template.md`
