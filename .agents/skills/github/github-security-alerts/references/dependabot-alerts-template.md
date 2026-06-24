# Dependabot Alerts via gh api (template mode)

Use Go template output to avoid gigantic JSON parsing failures.

Command:
```bash
gh api -H 'Accept: application/vnd.github+json' \
  /repos/<org>/<repo>/dependabot/alerts --paginate \
  --template '{{range .}}{{.number}}\t{{.state}}\t{{.security_vulnerability.severity}}\t{{.dependency.package.name}}\t{{.dependency.manifest_path}}\t{{.dependency.scope}}\t{{.dependency.relationship}}\t{{.security_vulnerability.vulnerable_version_range}}\t{{if .security_vulnerability.first_patched_version}}{{.security_vulnerability.first_patched_version.identifier}}{{end}}\t{{.security_advisory.ghsa_id}}\t{{.security_advisory.cve_id}}\t{{.security_advisory.summary}}\n{{end}}'
```

Notes:
- If the UI returns 404 but API works, it’s usually due to login/permissions.
- Use the alert URL format:
  `https://github.com/<org>/<repo>/security/dependabot/<number>`
