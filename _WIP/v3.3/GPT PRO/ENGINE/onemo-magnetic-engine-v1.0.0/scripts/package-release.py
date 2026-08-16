from __future__ import annotations
import hashlib
import os
import shutil
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
VERSION = '1.0.0'
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
EXCLUDED_NAMES = {'node_modules', '.git', '.DS_Store', '__pycache__'}

def included_files(base: Path):
    for path in sorted(base.rglob('*')):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_NAMES for part in path.relative_to(base).parts):
            continue
        if path.suffix == '.pyc':
            continue
        yield path

def write_zip(zip_path: Path, entries: list[tuple[Path, str]]):
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source, archive_name in sorted(entries, key=lambda x: x[1]):
            data = source.read_bytes()
            info = zipfile.ZipInfo(archive_name.replace(os.sep, '/'), FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100755 if os.access(source, os.X_OK) else 0o100644) << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

def package_entries(package_rel: str):
    package = ROOT / package_rel
    entries = [(path, f'{Path(package_rel).name}/{path.relative_to(package)}') for path in included_files(package)]
    entries += [(ROOT / 'LICENSE', 'LICENSE')]
    entries += [(path, f'specs/{path.name}') for path in included_files(ROOT / 'specs')]
    return entries

DIST.mkdir(parents=True, exist_ok=True)
for old in DIST.glob('*.zip'):
    old.unlink()

archives = [
    (DIST / f'onemo-geometry-compute-v{VERSION}.zip', package_entries('packages/geometry-compute')),
    (DIST / f'onemo-magnetic-logic-v{VERSION}.zip', package_entries('packages/magnetic-logic')),
    (DIST / f'onemo-magnetic-next-v{VERSION}.zip', package_entries('packages/magnetic-next')),
]
for path, entries in archives:
    write_zip(path, entries)

checksums = []
for path, _ in archives:
    checksums.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}')
(DIST / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')

master_path = ROOT.parent / f'onemo-magnetic-engine-v{VERSION}.zip'
master_entries = []
for path in included_files(ROOT):
    if path == master_path:
        continue
    master_entries.append((path, f'onemo-magnetic-engine-v{VERSION}/{path.relative_to(ROOT)}'))
write_zip(master_path, master_entries)

master_hash = hashlib.sha256(master_path.read_bytes()).hexdigest()
(ROOT.parent / f'onemo-magnetic-engine-v{VERSION}.sha256').write_text(f'{master_hash}  {master_path.name}\n')
print(master_path)
for path, _ in archives:
    print(path)
print(f'master_sha256={master_hash}')
