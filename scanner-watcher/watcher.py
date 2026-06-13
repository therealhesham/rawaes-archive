"""
Rawaes Scan Watcher
====================
Watches a folder for new scanned files and uploads them to the Rawaes archive.

Setup:
1. Edit config.ini with your settings
2. Install: pip install requests watchdog
3. Run: python watcher.py
4. (Windows) Use task scheduler or NSSM to run as service

Compatible with HP ScanJet 8270 "Scan to Folder" feature.
"""

import os
import time
import sys
import configparser
import logging
import threading
from pathlib import Path
import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from typing import List, Optional

def get_runtime_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


APP_DIR = get_runtime_dir()

# ────────────── CONFIG ──────────────
config = configparser.ConfigParser()
config_path = APP_DIR / 'config.ini'

if not config_path.exists():
    print('❌ config.ini not found! Copy config.ini.example to config.ini and edit it.')
    sys.exit(1)

config.read(config_path, encoding='utf-8')
WATCH_FOLDER = config.get('main', 'watch_folder')
API_URL = config.get('main', 'api_url').rstrip('/')
API_TOKEN = config.get('main', 'api_token')
DEVICE_NAME = config.get('main', 'device_name', fallback='Scanner-PC')
PROCESSED_FOLDER = config.get('main', 'processed_folder', fallback='processed')
BRIDGE_ENABLED = config.getboolean('main', 'bridge_enabled', fallback=True)
BRIDGE_PORT = config.getint('main', 'bridge_port', fallback=9999)
PREFERRED_SCANNER = config.get('main', 'preferred_scanner', fallback='')
SCAN_SOURCE = config.get('main', 'scan_source', fallback='feeder')
SCAN_COLOR = config.get('main', 'scan_color', fallback='gray')
SCAN_DPI = config.getint('main', 'scan_dpi', fallback=150)
SCAN_DUPLEX = config.getboolean('main', 'scan_duplex', fallback=False)
SCAN_MAX_PAGES = config.getint('main', 'scan_max_pages', fallback=100)
ALLOWED_EXTS = {'.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'}

# Batch mode: merge many scanned pages into one PDF
BATCH_ENABLED = config.getboolean('main', 'batch_enabled', fallback=True)
BATCH_WINDOW_SECONDS = config.getint('main', 'batch_window_seconds', fallback=8)
BATCH_MIN_FILES = config.getint('main', 'batch_min_files', fallback=2)

# ────────────── LOGGING ──────────────
log_file = APP_DIR / 'watcher.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(log_file, encoding='utf-8'), logging.StreamHandler()],
)
log = logging.getLogger('watcher')


# ────────────── UPLOAD ──────────────
def upload_file(filepath: Path, retry: int = 3) -> bool:
    """Upload one scanned file to the Rawaes API."""
    if not filepath.exists() or filepath.stat().st_size == 0:
        return False

    log.info(f'📤 Uploading: {filepath.name} ({filepath.stat().st_size} bytes)')

    for attempt in range(1, retry + 1):
        try:
            with open(filepath, 'rb') as f:
                response = requests.post(
                    f'{API_URL}/api/scans/upload',
                    headers={'X-Scan-Token': API_TOKEN, 'Accept': 'application/json'},
                    files={'file': (filepath.name, f, 'application/octet-stream')},
                    data={'device': DEVICE_NAME, 'original_name': filepath.name},
                    timeout=120,
                )

            if response.status_code == 200:
                log.info(f'✅ Uploaded successfully: {filepath.name}')
                return True
            else:
                log.error(f'❌ Server error {response.status_code}: {response.text[:200]}')

        except requests.RequestException as e:
            log.warning(f'🔄 Attempt {attempt}/{retry} failed: {e}')
            if attempt < retry:
                time.sleep(5 * attempt)

    return False


def move_to_processed(filepath: Path):
    """Move successfully uploaded file to a 'processed' subfolder."""
    processed_dir = filepath.parent / PROCESSED_FOLDER
    processed_dir.mkdir(exist_ok=True)
    new_path = processed_dir / f'{int(time.time())}-{filepath.name}'
    try:
        filepath.rename(new_path)
        log.info(f'📁 Moved to processed: {new_path.name}')
    except Exception as e:
        log.error(f'⚠️  Could not move file: {e}')


def wait_until_stable(filepath: Path, max_seconds: int = 30) -> bool:
    """Wait for file to finish writing (stability check)."""
    last_size = -1
    for _ in range(max_seconds):
        try:
            current_size = filepath.stat().st_size
            if current_size > 0 and current_size == last_size:
                return True
            last_size = current_size
        except FileNotFoundError:
            return False
        time.sleep(1)
    return filepath.exists() and filepath.stat().st_size > 0


def merge_images_to_pdf(images: List[Path], out_pdf: Path) -> bool:
    """Merge multiple image files into a single PDF."""
    try:
        from PIL import Image
    except ImportError:
        log.error('Pillow not installed. Run: pip install pillow')
        return False

    opened = []
    try:
        for fp in images:
            img = Image.open(fp)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            opened.append(img)

        if not opened:
            return False

        out_pdf.parent.mkdir(parents=True, exist_ok=True)
        first, rest = opened[0], opened[1:]
        first.save(out_pdf, 'PDF', save_all=True, append_images=rest)
        return out_pdf.exists() and out_pdf.stat().st_size > 0
    except Exception as e:
        log.error(f'❌ PDF merge failed: {e}')
        return False
    finally:
        for img in opened:
            try:
                img.close()
            except Exception:
                pass


def process_file(filepath: Path):
    """Wait for file to stabilize then upload."""
    if filepath.suffix.lower() not in ALLOWED_EXTS:
        log.debug(f'Ignoring non-scan file: {filepath.name}')
        return

    if not wait_until_stable(filepath):
        return

    if upload_file(filepath):
        move_to_processed(filepath)


class BatchCollector:
    """
    Collects multiple scanned page files and merges them into one PDF after a quiet window.
    Useful when scanners output one image per page into the watch folder.
    """

    def __init__(self, window_seconds: int, min_files: int):
        self.window_seconds = max(2, int(window_seconds))
        self.min_files = max(2, int(min_files))
        self._lock = threading.Lock()
        self._timer = None  # type: Optional[threading.Timer]
        self._paths = []  # type: List[Path]

    def add(self, path: Path):
        if path.suffix.lower() not in ALLOWED_EXTS:
            return

        with self._lock:
            self._paths.append(path)
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.window_seconds, self.flush)
            self._timer.daemon = True
            self._timer.start()

    def flush(self):
        with self._lock:
            paths = self._paths
            self._paths = []
            self._timer = None

        if not paths:
            return

        # Wait until all files are stable
        stable = []
        for p in paths:
            if wait_until_stable(p):
                stable.append(p)

        if not stable:
            return

        stable.sort(key=lambda p: (p.stat().st_mtime, p.name))

        image_files = [p for p in stable if p.suffix.lower() in IMAGE_EXTS]
        other_files = [p for p in stable if p.suffix.lower() not in IMAGE_EXTS]

        # Non-image files: upload individually (PDF from scanner already)
        for p in other_files:
            process_file(p)

        # Merge images into one PDF if enough pages
        if len(image_files) >= self.min_files:
            ts = time.strftime('%Y%m%d-%H%M%S')
            out_pdf = image_files[0].parent / f'scan-{DEVICE_NAME}-{ts}.pdf'
            log.info(f'🧩 Merging {len(image_files)} pages into one PDF: {out_pdf.name}')
            if merge_images_to_pdf(image_files, out_pdf):
                if upload_file(out_pdf):
                    move_to_processed(out_pdf)
                    for p in image_files:
                        try:
                            move_to_processed(p)
                        except Exception:
                            pass
                else:
                    log.error('❌ Upload merged PDF failed; leaving original pages.')
            else:
                log.error('❌ Could not merge pages; uploading pages individually.')
                for p in image_files:
                    process_file(p)
        else:
            # Not enough pages: upload individually
            for p in image_files:
                process_file(p)


# ────────────── EVENT HANDLER ──────────────
class ScanHandler(FileSystemEventHandler):
    def __init__(self, batch: Optional[BatchCollector]):
        super().__init__()
        self.batch = batch

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if self.batch and BATCH_ENABLED:
            self.batch.add(path)
        else:
            threading.Thread(target=process_file, args=(path,), daemon=True).start()

    def on_moved(self, event):
        if event.is_directory:
            return
        path = Path(event.dest_path)
        if self.batch and BATCH_ENABLED:
            self.batch.add(path)
        else:
            threading.Thread(target=process_file, args=(path,), daemon=True).start()


# ────────────── STARTUP CHECKS ──────────────
def health_check():
    """Verify the API is reachable and token is valid."""
    log.info(f'🔍 Connecting to {API_URL}...')
    try:
        r = requests.get(
            f'{API_URL}/api/scans/ping',
            headers={'X-Scan-Token': API_TOKEN},
            timeout=10,
        )
        if r.status_code == 200:
            log.info('✅ API connection OK')
            return True
        elif r.status_code == 401:
            log.error('❌ Invalid API token! Check config.ini')
        else:
            log.error(f'❌ API returned {r.status_code}: {r.text[:200]}')
    except Exception as e:
        log.error(f'❌ Cannot reach API: {e}')
    return False


def process_existing_files(folder: Path, batch: Optional[BatchCollector]):
    """Process any files already in the folder on startup."""
    log.info(f'🔎 Scanning existing files in {folder}...')
    existing = []
    for entry in folder.iterdir():
        if entry.is_file() and entry.suffix.lower() in ALLOWED_EXTS:
            log.info(f'   Found: {entry.name}')
            if batch and BATCH_ENABLED:
                existing.append(entry)
            else:
                threading.Thread(target=process_file, args=(entry,), daemon=True).start()

    if existing and batch and BATCH_ENABLED:
        for p in existing:
            batch.add(p)
        # Flush soon (don't wait full window on startup)
        batch.flush()


# ────────────── MAIN ──────────────
def main():
    folder = Path(WATCH_FOLDER)
    if not folder.exists():
        log.error(f'❌ Watch folder does not exist: {folder}')
        sys.exit(1)

    log.info('═' * 50)
    log.info('🚀 Rawaes Scan Watcher Starting')
    log.info(f'📁 Watching: {folder}')
    log.info(f'🌐 API:      {API_URL}')
    log.info(f'💻 Device:   {DEVICE_NAME}')
    log.info('═' * 50)

    if not health_check():
        log.warning('⚠️  Will keep retrying in background...')

    # Start the local HTTP bridge for browser-triggered scans
    if BRIDGE_ENABLED:
        try:
            from scan_bridge import run_bridge, list_scanners
            # Show available scanners on startup
            scanners = list_scanners()
            if scanners:
                log.info(f'━━━ Available scanners ({len(scanners)}) ━━━')
                for i, s in enumerate(scanners, 1):
                    log.info(f'   [{i}] {s["name"]}')
                log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                if PREFERRED_SCANNER:
                    matches = [s for s in scanners if PREFERRED_SCANNER.lower() in s['name'].lower()]
                    if matches:
                        log.info(f'🎯 Will use: {matches[0]["name"]} (matched "{PREFERRED_SCANNER}")')
                    else:
                        log.warning(f'⚠️ No scanner matches "{PREFERRED_SCANNER}". Will use first available.')
            else:
                log.warning('⚠️ No scanners found! Check Windows Settings.')

            run_bridge(
                API_TOKEN,
                folder,
                port=BRIDGE_PORT,
                preferred_scanner=PREFERRED_SCANNER,
                default_source=SCAN_SOURCE,
                default_color=SCAN_COLOR,
                default_dpi=SCAN_DPI,
                default_duplex=SCAN_DUPLEX,
                default_max_pages=SCAN_MAX_PAGES,
            )
        except Exception as e:
            log.warning(f'⚠️  Could not start scan bridge: {e}')

    batch = BatchCollector(BATCH_WINDOW_SECONDS, BATCH_MIN_FILES) if BATCH_ENABLED else None
    process_existing_files(folder, batch)

    observer = Observer()
    observer.schedule(ScanHandler(batch), str(folder), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        log.info('🛑 Stopping watcher...')
        observer.stop()
    observer.join()


if __name__ == '__main__':
    main()
