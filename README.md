# Dhruvgarg111.github.io

Personal portfolio — **Ground Truth** field survey (coarse → ROI → specimen).

Live site: https://www.dhruvgarg.tech/

## Local preview

```bash
python -m http.server 8780
```

Open http://127.0.0.1:8780/

## Production assets

The contact background ships as optimized runtime variants:

- `assets/img/footer-1920.webp` — preferred runtime format
- `assets/img/footer-1920.jpg` — fallback/runtime source

The original `assets/img/footer.jpg` source is not in the working tree; it remains only in Git history. The optimized variants are the canonical production assets in this checkout. Regeneration requires restoring that historical source first, then running:

```bash
python -c "from PIL import Image; im=Image.open('assets/img/footer.jpg').convert('RGB'); im.thumbnail((1920, 1920), Image.Resampling.LANCZOS); im.save('assets/img/footer-1920.webp', 'WEBP', quality=74, method=6); im.save('assets/img/footer-1920.jpg', 'JPEG', quality=76, optimize=True, progressive=True)"
```

## Release checks

This is a static site with canonical readable sources plus committed production bundles. Before release, regenerate the minified CSS/JS artifacts, run `node --check` on source and minified JavaScript, verify all local asset references, and run the desktop/mobile browser smoke matrix documented in `docs/analysis/2026-08-15-performance-remediation-report.md`.
