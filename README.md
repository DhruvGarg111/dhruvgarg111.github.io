# Dhruvgarg111.github.io

Personal portfolio — **Ground Truth** field survey (coarse → ROI → specimen).

Live site: https://www.dhruvgarg.tech/

## Local preview

```bash
python -m http.server 8780
```

Open http://127.0.0.1:8780/

## Asset pipeline

Regenerate hero WebP/JPEG variants, OG card, and compressed logo:

```bash
python scripts/build_assets.py
```

Place a higher-resolution aerial source at the path in `scripts/build_assets.py` (`SESSION_SRC` or `portfolio_audit/ground-truth-hero.png`) before rebuilding.
