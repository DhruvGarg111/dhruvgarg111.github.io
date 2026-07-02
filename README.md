# Dhruvgarg111.github.io

Personal portfolio — **Ground Truth** field survey (coarse → ROI → specimen).

Live site: https://www.dhruvgarg.tech/

## Local preview

```bash
python -m http.server 8780
```

Open http://127.0.0.1:8780/

## Asset notes

The contact background keeps `assets/img/footer.jpg` as the source image and serves optimized runtime variants:

- `assets/img/footer-1920.webp`
- `assets/img/footer-1920.jpg`

Regenerate those variants with Pillow:

```bash
python -c "from PIL import Image; from pathlib import Path; im=Image.open('assets/img/footer.jpg').convert('RGB'); im.thumbnail((1920, 1920), Image.Resampling.LANCZOS); im.save('assets/img/footer-1920.webp', 'WEBP', quality=74, method=6); im.save('assets/img/footer-1920.jpg', 'JPEG', quality=76, optimize=True, progressive=True)"
```
