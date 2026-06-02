"""
Local HTTP Bridge that lets the browser trigger the scanner.
Runs alongside watcher.py — exposes localhost:9999/scan
"""

import logging
import os
import sys
import tempfile
import time
import threading
from pathlib import Path
from typing import Optional

log = logging.getLogger('bridge')


def _set_property(props, prop_id, value):
    """Helper to set a WIA property by ID."""
    for prop in props:
        if prop.PropertyID == prop_id:
            try:
                prop.Value = value
                return True
            except Exception as e:
                log.debug(f'Could not set property {prop_id}={value}: {e}')
    return False


def scan_via_wia_multi(output_dir: Path, color: str = 'color', dpi: int = 200,
                       preferred_scanner: str = '', source: str = 'feeder',
                       max_pages: int = 100) -> list:
    """
    Scan all available pages from the ADF (feeder) in one go.
    Returns list of file paths.
    """
    try:
        import pythoncom
        from win32com.client import Dispatch
    except ImportError:
        log.error('pywin32 not installed. Run: pip install pywin32')
        return []

    pythoncom.CoInitialize()
    paths = []

    try:
        manager = Dispatch('WIA.DeviceManager')
        devices = manager.DeviceInfos
        if devices.Count == 0:
            log.error('No WIA scanner found')
            return []

        # List ALL scanners with index
        all_scanners = []
        log.info(f'━━━ Found {devices.Count} scanner(s) ━━━')
        for i in range(1, devices.Count + 1):
            d = devices(i)
            name = d.Properties('Name').Value
            all_scanners.append((i, d, name))
            log.info(f'   [{i}] {name}')

        # Find scanner — match preferred_scanner first
        device_info = None
        if preferred_scanner:
            # First try EXACT match
            for idx, d, name in all_scanners:
                if name.lower() == preferred_scanner.lower():
                    device_info = d
                    log.info(f'✓ Exact match: [{idx}] {name}')
                    break

            # Then prefer ones WITHOUT "#" (original, not duplicate)
            if not device_info:
                for idx, d, name in all_scanners:
                    if preferred_scanner.lower() in name.lower() and '#' not in name:
                        device_info = d
                        log.info(f'✓ Selected (no dup): [{idx}] {name}')
                        break

            # Last resort: ANY match
            if not device_info:
                for idx, d, name in all_scanners:
                    if preferred_scanner.lower() in name.lower():
                        device_info = d
                        log.warning(f'⚠️ Fell back to: [{idx}] {name} (consider removing duplicates from Windows)')
                        break

        if not device_info:
            if preferred_scanner:
                log.warning(f'⚠️ No match for "{preferred_scanner}". Using first device.')
            device_info = devices(1)

        scanner_name = device_info.Properties('Name').Value
        log.info(f'🖨️ Using scanner: {scanner_name}')
        device = device_info.Connect()

        WIA_DPS_DOCUMENT_HANDLING_SELECT = 3088
        WIA_DPS_PAGES = 3096
        WIA_FORMAT_JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'

        source_value = 1 if source == 'feeder' else 2 if source == 'flatbed' else None

        if source_value is not None:
            if _set_property(device.Properties, WIA_DPS_DOCUMENT_HANDLING_SELECT, source_value):
                log.info(f'📥 Source: {source}')

        output_dir.mkdir(parents=True, exist_ok=True)

        # For flatbed: only one page
        if source == 'flatbed':
            item = device.Items(1)
            for prop_id, value in {6146: 1 if color == 'gray' else 2 if color == 'bw' else 0,
                                    6147: dpi, 6148: dpi}.items():
                _set_property(item.Properties, prop_id, value)
            try:
                image = item.Transfer(WIA_FORMAT_JPEG)
                fp = output_dir / f'scan-{int(time.time() * 1000)}-1.jpg'
                image.SaveFile(str(fp))
                paths.append(fp)
                log.info(f'✅ Page 1 saved: {fp.name}')
            except Exception as e:
                log.error(f'❌ Flatbed scan error: {e}')
            return paths

        # For feeder: try multiple approaches
        item = device.Items(1)
        for prop_id, value in {6146: 1 if color == 'gray' else 2 if color == 'bw' else 0,
                                6147: dpi, 6148: dpi}.items():
            _set_property(item.Properties, prop_id, value)

        start_time = time.time()

        # ─── Approach 1: Multi-page TIFF (standard WIA pattern for ADF) ───
        # Set PAGES = 0 (scan ALL pages from feeder)
        _set_property(device.Properties, WIA_DPS_PAGES, 0)
        WIA_FORMAT_TIFF = '{B96B3CB1-0728-11D3-9D7B-0000F81EF32E}'

        try:
            log.info('🔄 Trying multi-page TIFF mode (all pages at once)...')
            tiff_path = output_dir / f'scan-{int(time.time() * 1000)}.tif'
            image = item.Transfer(WIA_FORMAT_TIFF)
            image.SaveFile(str(tiff_path))
            log.info(f'   TIFF saved ({tiff_path.stat().st_size // 1024} KB)')

            # Split TIFF into individual JPEGs using Pillow
            try:
                from PIL import Image as PILImage
                with PILImage.open(tiff_path) as img:
                    n_frames = getattr(img, 'n_frames', 1)
                    log.info(f'   Extracted {n_frames} pages from TIFF')
                    for frame_idx in range(n_frames):
                        img.seek(frame_idx)
                        page_path = output_dir / f'scan-{int(time.time() * 1000)}-{frame_idx + 1}.jpg'
                        img.convert('RGB').save(str(page_path), 'JPEG', quality=85)
                        paths.append(page_path)
                        log.info(f'✅ Page {frame_idx + 1} extracted')
                tiff_path.unlink(missing_ok=True)
                log.info(f'📤 Done — {len(paths)} pages in {time.time() - start_time:.1f}s')
                return paths
            except ImportError:
                log.error('Pillow not installed: pip install pillow')
                return paths
        except Exception as e:
            msg = str(e).lower()
            log.warning(f'⚠️ Multi-page TIFF failed: {e}')

            # ─── Approach 2: Loop one-by-one (fallback) ───
            log.info('🔄 Falling back to single-page loop...')
            _set_property(device.Properties, WIA_DPS_PAGES, 1)

            page_num = 0
            while page_num < max_pages:
                page_num += 1
                try:
                    image = item.Transfer(WIA_FORMAT_JPEG)
                    fp = output_dir / f'scan-{int(time.time() * 1000)}-{page_num}.jpg'
                    image.SaveFile(str(fp))
                    paths.append(fp)
                    log.info(f'✅ Page {page_num}')
                except Exception as e2:
                    msg2 = str(e2).lower()
                    end_indicators = ['paper', 'empty', 'ready', 'no documents', '80210003',
                                      '80210064', 'feeder', '80070057', 'parameter is incorrect']
                    if any(c in msg2 for c in end_indicators):
                        log.info(f'📤 ADF finished — {page_num - 1} pages')
                    else:
                        log.error(f'❌ Page {page_num} error: {e2}')
                    break

        return paths

    except Exception as e:
        log.error(f'❌ WIA scan error: {e}')
        return paths
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def scan_via_wia(output_dir: Path, color: str = 'color', dpi: int = 200,
                 preferred_scanner: str = '', source: str = 'feeder') -> Optional[Path]:
    """
    Trigger a scan using Windows Image Acquisition (WIA).
    Returns the path of the saved scan, or None on failure.

    Args:
        preferred_scanner: substring of scanner name to match (case-insensitive)
        source: 'feeder' (ADF tray) | 'flatbed' (glass) | 'auto'

    Requires: pywin32 (pip install pywin32)
    """
    try:
        import pythoncom
        from win32com.client import Dispatch
    except ImportError:
        log.error('pywin32 not installed. Run: pip install pywin32')
        return None

    pythoncom.CoInitialize()

    try:
        manager = Dispatch('WIA.DeviceManager')
        devices = manager.DeviceInfos
        if devices.Count == 0:
            log.error('No WIA scanner found. Add the scanner in Windows Settings > Printers & scanners')
            return None

        # Find scanner
        device_info = None
        all_names = []
        for i in range(1, devices.Count + 1):
            d = devices(i)
            name = d.Properties('Name').Value
            all_names.append(name)
            if preferred_scanner and preferred_scanner.lower() in name.lower():
                device_info = d
                break

        if not device_info:
            if preferred_scanner:
                log.warning(f'⚠️ Scanner matching "{preferred_scanner}" not found. Available: {all_names}')
                log.warning('Falling back to first scanner')
            device_info = devices(1)

        log.info(f'🖨️ Using scanner: {device_info.Properties("Name").Value}')
        device = device_info.Connect()

        # Set DOCUMENT_HANDLING_SELECT on device level (3088)
        # 1 = FEEDER, 2 = FLATBED, 4 = DUPLEX
        WIA_DPS_DOCUMENT_HANDLING_SELECT = 3088
        WIA_DPS_PAGES = 3096

        source_value = None
        if source == 'feeder':
            source_value = 1
        elif source == 'flatbed':
            source_value = 2

        if source_value is not None:
            ok = _set_property(device.Properties, WIA_DPS_DOCUMENT_HANDLING_SELECT, source_value)
            if ok:
                log.info(f'📥 Source set to: {source}')
                # Set pages = 1 (scan one page from feeder)
                _set_property(device.Properties, WIA_DPS_PAGES, 1)
            else:
                log.warning(f'⚠️ Could not set source to {source} - device may not support it')

        item = device.Items(1)

        # Configure scan properties on item
        properties_map = {
            6146: 1 if color == 'gray' else 2 if color == 'bw' else 0,  # CurrentIntent
            6147: dpi,   # Horizontal Resolution
            6148: dpi,   # Vertical Resolution
        }

        for prop_id, value in properties_map.items():
            _set_property(item.Properties, prop_id, value)

        # Transfer the image
        WIA_FORMAT_JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
        image = item.Transfer(WIA_FORMAT_JPEG)

        # Save to file
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f'scan-{int(time.time() * 1000)}.jpg'
        filepath = output_dir / filename
        image.SaveFile(str(filepath))

        log.info(f'✅ Scan saved: {filepath}')
        return filepath

    except Exception as e:
        msg = str(e)
        # Common error: ADF empty
        if '0x80210003' in msg or 'paper' in msg.lower() or 'empty' in msg.lower():
            log.error('❌ الدرج فارغ — ضع الورق في درج السكانر')
        else:
            log.error(f'❌ WIA scan error: {e}')
        return None
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def list_scanners() -> list:
    """List all WIA scanners installed in Windows."""
    try:
        import pythoncom
        from win32com.client import Dispatch
    except ImportError:
        return []

    pythoncom.CoInitialize()
    try:
        manager = Dispatch('WIA.DeviceManager')
        devices = manager.DeviceInfos
        result = []
        for i in range(1, devices.Count + 1):
            d = devices(i)
            result.append({
                'id': d.DeviceID,
                'name': d.Properties('Name').Value,
            })
        return result
    except Exception as e:
        log.error(f'List scanners error: {e}')
        return []
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def create_app(scan_token: str, scans_folder: Path, preferred_scanner: str = '', default_source: str = 'feeder'):
    """Create the Flask bridge application."""
    try:
        from flask import Flask, request, jsonify, send_file
        from flask_cors import CORS
    except ImportError:
        log.error('Flask not installed. Run: pip install flask flask-cors')
        return None

    app = Flask(__name__)
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        allow_headers=["Content-Type", "X-Scan-Token", "Authorization", "Access-Control-Request-Private-Network"],
        methods=["GET", "POST", "OPTIONS"],
    )

    # Add Private Network Access header for Chrome PNA policy
    @app.after_request
    def add_pna_headers(response):
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Scan-Token, Authorization, Access-Control-Request-Private-Network'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        return response

    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'service': 'Rawaes Scan Bridge',
            'status': 'ok',
            'endpoints': ['/health', '/scanners', '/scan'],
        })

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'service': 'rawaes-scan-bridge'})

    @app.route('/scanners', methods=['GET'])
    def scanners_list():
        if request.headers.get('X-Scan-Token') != scan_token:
            return jsonify({'error': 'unauthorized'}), 401
        return jsonify({'scanners': list_scanners()})

    @app.route('/scan-batch', methods=['POST', 'OPTIONS'])
    def scan_batch():
        """Scan all pages from feeder. Returns JSON with array of base64 images."""
        if request.method == 'OPTIONS':
            return '', 204

        if request.headers.get('X-Scan-Token') != scan_token:
            return jsonify({'error': 'unauthorized'}), 401

        body = request.get_json(silent=True) or {}
        color = body.get('color', 'color')
        dpi = int(body.get('dpi', 200))
        source = body.get('source', default_source)

        log.info(f'📥 Batch scan: source={source}, color={color}, dpi={dpi}')

        tmp_dir = Path(tempfile.gettempdir()) / 'rawaes_scans'
        tmp_dir.mkdir(parents=True, exist_ok=True)

        paths = scan_via_wia_multi(
            tmp_dir, color=color, dpi=dpi,
            preferred_scanner=preferred_scanner, source=source,
        )

        if not paths:
            return jsonify({
                'error': 'no_pages',
                'message': 'لم يتم مسح أي صفحة. تأكد من وجود ورق في الدرج وأن السكانر جاهز.',
            }), 500

        # Convert all to base64
        import base64
        pages = []
        for fp in paths:
            try:
                with open(fp, 'rb') as f:
                    data = f.read()
                pages.append({
                    'name': fp.name,
                    'mime': 'image/jpeg',
                    'data': base64.b64encode(data).decode('ascii'),
                })
                fp.unlink(missing_ok=True)
            except Exception as e:
                log.warning(f'Could not read {fp}: {e}')

        log.info(f'✅ Returning {len(pages)} pages to browser')
        return jsonify({'pages': pages, 'count': len(pages)})

    @app.route('/scan', methods=['POST', 'OPTIONS'])
    def scan():
        if request.method == 'OPTIONS':
            return '', 204

        if request.headers.get('X-Scan-Token') != scan_token:
            return jsonify({'error': 'unauthorized'}), 401

        body = request.get_json(silent=True) or {}
        color = body.get('color', 'color')  # color | gray | bw
        dpi = int(body.get('dpi', 200))
        source = body.get('source', default_source)  # feeder | flatbed | auto

        log.info(f'📥 Scan request: source={source}, color={color}, dpi={dpi}')

        # Use a unique temp file (not directory) to avoid cleanup issues on Windows
        import io, uuid
        tmp_dir = Path(tempfile.gettempdir()) / 'rawaes_scans'
        tmp_dir.mkdir(parents=True, exist_ok=True)

        filepath = scan_via_wia(tmp_dir, color=color, dpi=dpi, preferred_scanner=preferred_scanner, source=source)
        if not filepath or not filepath.exists():
            return jsonify({'error': 'scan_failed', 'message': 'Could not scan. Make sure scanner is on and ready.'}), 500

        try:
            # Read file into memory then delete immediately
            with open(filepath, 'rb') as f:
                data = f.read()
            try:
                filepath.unlink()
            except Exception as e:
                log.warning(f'Could not delete temp file: {e}')

            from flask import Response
            return Response(
                data,
                mimetype='image/jpeg',
                headers={
                    'Content-Disposition': f'inline; filename="{filepath.name}"',
                    'Content-Length': str(len(data)),
                },
            )
        except Exception as e:
            log.error(f'Error reading scan: {e}')
            return jsonify({'error': 'read_failed', 'message': str(e)}), 500

    return app


def run_bridge(scan_token: str, scans_folder: Path, port: int = 9999, preferred_scanner: str = '', default_source: str = 'feeder'):
    """Start the bridge in a background thread."""
    app = create_app(scan_token, scans_folder, preferred_scanner=preferred_scanner, default_source=default_source)
    if not app:
        log.warning('⚠️  Bridge disabled (Flask not installed)')
        return

    def serve():
        log.info(f'🌉 Scan Bridge running on http://localhost:{port}')
        try:
            from werkzeug.serving import make_server
            server = make_server('127.0.0.1', port, app, threaded=True)
            server.serve_forever()
        except Exception as e:
            log.error(f'Bridge crashed: {e}')

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    return t
