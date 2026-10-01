"""Create a reproducible Chrome Web Store ZIP using only Python's standard library."""
import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
FILES = [
    "manifest.json", "background.js", "viewer.html", "viewer.css", "viewer.js",
    "worker.js", "i18n.js", "vendor/fzstd.js", "vendor/fzstd.LICENSE",
    "icons/icon16.png", "icons/icon48.png", "icons/icon128.png", "LICENSE",
]
FILES.extend(str(path.relative_to(ROOT)) for path in (ROOT / "_locales").glob("*/messages.json"))
OUT = ROOT / "dist" / f"jsonl-preview-v{MANIFEST['version']}.zip"
if "--check" in sys.argv:
    with ZipFile(OUT) as archive:
        if archive.namelist() != sorted(FILES):
            raise SystemExit("Package file list differs from runtime files")
        for name in FILES:
            if archive.read(name) != (ROOT / name).read_bytes():
                raise SystemExit(f"Package is stale: {name}")
    print(f"Package matches source: {OUT}")
else:
    OUT.parent.mkdir(exist_ok=True)
    with ZipFile(OUT, "w") as archive:
        for name in sorted(FILES):
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, (ROOT / name).read_bytes(), compresslevel=9)
    print(f"Created {OUT}")
