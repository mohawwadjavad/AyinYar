#!/usr/bin/env python3
"""Validate AyinYar source and build reproducible XPI/release archives."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DIST = ROOT / "dist"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def check(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def validate() -> tuple[str, dict]:
    manifest_path = SRC / "manifest.json"
    check(manifest_path.is_file(), "src/manifest.json is missing")
    manifest = json.loads(manifest_path.read_text("utf-8"))
    version = manifest.get("version", "")
    check(bool(version), "manifest version is empty")
    check(manifest.get("manifest_version") == 2, "Unexpected Zotero manifest format")
    zotero = manifest.get("applications", {}).get("zotero", {})
    check(zotero.get("strict_min_version") == "10.0", "Unexpected Zotero minimum version")
    check(zotero.get("strict_max_version") == "10.0.*", "Unexpected Zotero maximum version")
    expected_update_url = "https://github.com/mohawwadjavad/AyinYar/releases/latest/download/updates.json"
    check(zotero.get("update_url") == expected_update_url, "Zotero update_url must point to the stable latest-release updates.json")
    check(manifest.get("homepage_url") == "https://github.com/mohawwadjavad/AyinYar", "Project homepage_url is missing or incorrect")

    required = [
        SRC / "bootstrap.js", SRC / "content/selector.xhtml", SRC / "content/game.xhtml",
        SRC / "content/selector.css", SRC / "content/game.css",
        SRC / "content/assets/institution-academic-mark.png",
        SRC / "content/assets/institution-academic-mark.svg",
        SRC / "content/assets/fonts/Vazirmatn-Variable.woff2",
        ROOT / "README.md", ROOT / "INSTALL_FA.md", ROOT / "PRIVACY_FA.md",
        ROOT / "LICENSE", ROOT / "THANKS.txt", ROOT / "THIRD_PARTY_NOTICES.md",
        ROOT / "fonts/FONT_LICENSE_OFL_1.1.txt", ROOT / "CHANGELOG_FA.md", ROOT / "QA_REPORT_FA.md",
        SRC / "LICENSE", SRC / "THIRD_PARTY_NOTICES.md", SRC / "content/assets/fonts/OFL.txt",
    ]
    for path in required:
        check(path.is_file(), f"Required release file missing: {path.relative_to(ROOT)}")

    font = SRC / "content/assets/fonts/Vazirmatn-Variable.woff2"
    with font.open("rb") as f:
        check(f.read(4) == b"wOF2", "Bundled font is not a valid WOFF2 container")

    # Check XHTML and JSON syntax.
    for path in SRC.rglob("*.xhtml"):
        ET.parse(path)
    for path in SRC.rglob("*.svg"):
        ET.parse(path)
    for path in SRC.rglob("*.json"):
        json.loads(path.read_text("utf-8"))

    # Check JavaScript syntax using Node.js.
    node = shutil.which("node")
    check(node is not None, "Node.js is required for JavaScript syntax checks")
    js_files = sorted(SRC.rglob("*.js"))
    for path in js_files:
        proc = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
        check(proc.returncode == 0, f"JavaScript syntax error in {path.relative_to(ROOT)}:\n{proc.stderr}")

    # CSS parser is optional locally; CI installs tinycss2.
    try:
        import tinycss2  # type: ignore
        for path in SRC.rglob("*.css"):
            errors = [t for t in tinycss2.parse_stylesheet(path.read_text("utf-8"), skip_whitespace=True, skip_comments=True) if t.type == "error"]
            check(not errors, f"CSS parse error in {path.relative_to(ROOT)}: {errors[:2]}")
        css_checked = True
    except ImportError:
        css_checked = False

    # Verify institutional identity replacement and bundled-font-only behavior.
    text_files = [p for p in SRC.rglob("*") if p.is_file() and p.suffix.lower() in {".js", ".xhtml", ".css", ".json", ".md", ".txt"}]
    all_text = "\n".join(p.read_text("utf-8", errors="replace") for p in text_files)
    check("iaun-logo.png" not in all_text, "Old university logo reference remains in source")
    check(not (SRC / "content/iaun-logo.png").exists(), "Old university logo asset remains in source")
    check("institution-academic-mark.png" in all_text, "Independent academic mark is not referenced")
    check("Vazirmatn-Variable.woff2" in all_text, "Bundled font is not referenced")
    check("+989137901556" not in all_text, "Personal phone number must not be included in the public source")
    for pattern in (r"AIza[0-9A-Za-z_-]{30,}", r"sk-or-v1-[A-Za-z0-9]{20,}", r"sk-[A-Za-z0-9]{24,}"):
        check(re.search(pattern, all_text) is None, "Possible hard-coded API credential found in source")
    check("cdn.jsdelivr.net/gh/rastikerdar/vazirmatn" not in all_text, "Remote font CDN reference remains")
    check("Vazirmatn-Variable.woff2" in (SRC / "content/selector.css").read_text("utf-8"), "Main UI does not load bundled font")
    check("Vazirmatn-Variable.woff2" in (SRC / "content/game.css").read_text("utf-8"), "Game UI does not load bundled font")

    # Optional deeper font metadata validation when fontTools is installed.
    try:
        from fontTools.ttLib import TTFont  # type: ignore
        ft = TTFont(str(font))
        check("fvar" in ft, "Bundled Vazirmatn font is not variable")
        axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in ft["fvar"].axes}
        check(axes.get("wght") == (100.0, 400.0, 900.0), f"Unexpected Vazirmatn weight axis: {axes}")
        versions = []
        for n in ft["name"].names:
            if n.nameID == 5:
                try: versions.append(n.toUnicode())
                except Exception: pass
        check(any("33.003" in v for v in versions), f"Unexpected Vazirmatn font version: {versions}")
        font_metadata_checked = True
    except ImportError:
        font_metadata_checked = False

    return version, {
        "xhtml_files_parsed": len(list(SRC.rglob("*.xhtml"))),
        "json_files_parsed": len(list(SRC.rglob("*.json"))),
        "javascript_files_checked": len(js_files),
        "css_parser_checked": css_checked,
        "font_metadata_checked": font_metadata_checked,
        "font_bytes": font.stat().st_size,
        "source_files": sum(1 for p in SRC.rglob("*") if p.is_file()),
    }


def zip_add_tree(zf: zipfile.ZipFile, base: Path, arcbase: Path):
    excluded_dirs = {".git", "dist", "__pycache__", ".venv", "venv", "node_modules"}
    for path in sorted(base.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(base)
        if any(part in excluded_dirs for part in rel.parts):
            continue
        if path.name in {".DS_Store", "Thumbs.db"}:
            continue
        zf.write(path, arcbase / rel)


def main():
    global VERSION
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true", help="Run checks without building archives")
    args = parser.parse_args()
    VERSION, qa = validate()
    manifest_data = json.loads((SRC / "manifest.json").read_text("utf-8"))
    zotero_data = manifest_data["applications"]["zotero"]
    expected_update_url = zotero_data["update_url"]
    git_ref = os.environ.get("GITHUB_REF", "")
    if git_ref.startswith("refs/tags/"):
        tag = git_ref.removeprefix("refs/tags/")
        check(tag == f"v{VERSION}", f"Tag {tag} does not match manifest version v{VERSION}")
    print(f"Validation PASS — AyinYar v{VERSION}")
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    if args.validate_only:
        return

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    xpi = DIST / f"AyinYar_v{VERSION}_Zotero10.xpi"
    source_zip = DIST / f"AyinYar_v{VERSION}_Source.zip"
    complete_zip = DIST / f"AyinYar_v{VERSION}_Complete.zip"

    # XPI root must contain manifest.json, bootstrap.js, content/, assets/, and data/.
    with zipfile.ZipFile(xpi, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(SRC.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(SRC))
    with zipfile.ZipFile(xpi, "r") as zf:
        bad = zf.testzip()
        check(bad is None, f"XPI ZIP integrity check failed at {bad}")
        names = set(zf.namelist())
        check("manifest.json" in names and "bootstrap.js" in names, "XPI root structure is invalid")
        check("content/assets/fonts/Vazirmatn-Variable.woff2" in names, "Bundled font missing from XPI")
        check("content/assets/fonts/OFL.txt" in names, "SIL OFL license missing from XPI")
        check("LICENSE" in names and "THIRD_PARTY_NOTICES.md" in names, "Project/third-party notices missing from XPI")
        check("content/assets/institution-academic-mark.png" in names, "Independent mark missing from XPI")
        check("content/iaun-logo.png" not in names, "Old university logo found in XPI")
        xpi_manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        xpi_zotero = xpi_manifest.get("applications", {}).get("zotero", {})
        check(xpi_zotero.get("update_url") == expected_update_url, "Required Zotero update_url missing from built XPI")

    # Publish a Mozilla-style update manifest alongside every release.
    addon_id = zotero_data["id"]
    updates_manifest = {
        "addons": {
            addon_id: {
                "updates": [{
                    "version": VERSION,
                    "update_link": f"https://github.com/mohawwadjavad/AyinYar/releases/download/v{VERSION}/{xpi.name}",
                    "update_hash": f"sha256:{sha256(xpi)}",
                    "applications": {
                        "zotero": {
                            "strict_min_version": "10.0",
                            "strict_max_version": "10.0.*"
                        }
                    }
                }]
            }
        }
    }
    updates_path = DIST / "updates.json"
    updates_path.write_text(json.dumps(updates_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    parsed_updates = json.loads(updates_path.read_text("utf-8"))
    check(addon_id in parsed_updates.get("addons", {}), "Generated updates.json is missing the add-on ID")

    with zipfile.ZipFile(source_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zip_add_tree(zf, ROOT, Path(f"AyinYar_v{VERSION}"))
    with zipfile.ZipFile(source_zip, "r") as zf:
        check(zf.testzip() is None, "Source archive integrity check failed")

    with zipfile.ZipFile(complete_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zip_add_tree(zf, ROOT, Path(f"AyinYar_v{VERSION}"))
        zf.write(xpi, Path(f"AyinYar_v{VERSION}") / "release" / xpi.name)
        zf.write(updates_path, Path(f"AyinYar_v{VERSION}") / "release" / "updates.json")

    sums = []
    for path in (xpi, source_zip, complete_zip, updates_path):
        sums.append(f"{sha256(path)}  {path.name}")
    (DIST / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")
    build_manifest = {
        "name": "AyinYar Research", "version": VERSION,
        "zotero": {"min": "10.0", "max": "10.0.*"},
        "license": "All Rights Reserved (project code and original assets); Vazirmatn font is SIL OFL 1.1",
        "qa": qa,
        "artifacts": [{"name": p.name, "bytes": p.stat().st_size, "sha256": sha256(p)} for p in (xpi, source_zip, complete_zip, updates_path)],
    }
    (DIST / "BUILD_MANIFEST.json").write_text(json.dumps(build_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Release artifacts:")
    for path in (xpi, source_zip, complete_zip, updates_path, DIST / "SHA256SUMS.txt", DIST / "BUILD_MANIFEST.json"):
        print(f"- {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
