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

WIA_IPA_ITEM_CATEGORY = 4125
WIA_IPS_DOCUMENT_HANDLING_SELECT = 3088
WIA_DPS_DOCUMENT_HANDLING_SELECT = 3088
WIA_DPS_PAGES = 3096

WIA_CATEGORY_FEEDER = 'fe131934-f84c-42ad-8da4-6129cddd7288'
WIA_CATEGORY_FLATBED = 'fb607b1f-43f3-488b-855b-fb703ec342a6'


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


def _get_property_value(props, prop_id):
    for prop in props:
        if prop.PropertyID == prop_id:
            return prop.Value
    return None


def _normalize_guid(value) -> str:
    return str(value).strip().lower().strip('{}')


def _item_name(item) -> str:
    for prop_name in ('Item Name', 'Name'):
        try:
            return str(item.Properties(prop_name).Value)
        except Exception:
            continue
    return '<unknown item>'


def _get_item_category(item) -> str:
    return _normalize_guid(_get_property_value(item.Properties, WIA_IPA_ITEM_CATEGORY))


def _iter_items(items):
    for index in range(1, items.Count + 1):
        yield items(index)


def _select_source_item(device, source: str):
    candidates = list(_iter_items(device.Items))
    if not candidates:
        return None

    if len(candidates) == 1:
        item = candidates[0]
        log.info(f'🧩 Single WIA item detected: {_item_name(item)}')
        return item

    for index, item in enumerate(candidates, start=1):
        log.info(f'🧩 Item[{index}] name={_item_name(item)} category={_get_item_category(item) or "unknown"}')

    if source == 'flatbed':
        preferred_categories = {WIA_CATEGORY_FLATBED}
        name_hints = ('flatbed', 'glass')
    elif source == 'feeder':
        preferred_categories = {WIA_CATEGORY_FEEDER}
        name_hints = ('feeder', 'adf')
    else:
        preferred_categories = set()
        name_hints = ()

    if preferred_categories:
        for item in candidates:
            if _get_item_category(item) in preferred_categories:
                log.info(f'🎯 Selected WIA item by category: {_item_name(item)}')
                return item

        for item in candidates:
            lower_name = _item_name(item).lower()
            if any(hint in lower_name for hint in name_hints):
                log.info(f'🎯 Selected WIA item by name: {_item_name(item)}')
                return item

    log.info(f'🎯 Falling back to first WIA item: {_item_name(candidates[0])}')
    return candidates[0]


def _set_source_mode(device, item, source: str, duplex: bool) -> bool:
    source_value = None
    if source == 'flatbed':
        source_value = 2
    elif source == 'feeder':
        source_value = 1 | 4 if duplex else 1

    if source_value is None:
        log.info(f'📥 Source: {source} | duplex={duplex} (device default)')
        return True

    item_ok = _set_property(item.Properties, WIA_IPS_DOCUMENT_HANDLING_SELECT, source_value)
    device_ok = _set_property(device.Properties, WIA_DPS_DOCUMENT_HANDLING_SELECT, source_value)

    if item_ok or device_ok:
        where = []
        if item_ok:
            where.append('item')
        if device_ok:
            where.append('device')
        log.info(f'📥 Source: {source} | duplex={duplex} | set_on={"+".join(where)}')
        return True

    log.warning(f'⚠️ Could not force source {source}')
    return False


def _is_wia_no_documents_error(error: Exception) -> bool:
    message = str(error).lower()
    indicators = [
        'paper',
        'empty',
        'ready',
        'no documents',
        '80210003',
        '80210064',
        'feeder',
        '80070057',
        'parameter is incorrect',
    ]
    return any(indicator in message for indicator in indicators)


def _apply_scan_properties(item, color: str, dpi: int) -> None:
    for prop_id, value in {
        6146: 1 if color == 'gray' else 2 if color == 'bw' else 0,
        6147: dpi,
        6148: dpi,
    }.items():
        _set_property(item.Properties, prop_id, value)


def _scan_batch_from_connected_item(device, item, output_dir: Path, color: str, dpi: int, max_pages: int) -> tuple[list, Optional[Exception]]:
    paths = []
    WIA_FORMAT_JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
    WIA_FORMAT_TIFF = '{B96B3CB1-0728-11D3-9D7B-0000F81EF32E}'

    _apply_scan_properties(item, color, dpi)
    start_time = time.time()

    _set_property(device.Properties, WIA_DPS_PAGES, 0)

    try:
        log.info('🔄 Trying multi-page TIFF mode (all pages at once)...')
        tiff_path = output_dir / f'scan-{int(time.time() * 1000)}.tif'
        image = item.Transfer(WIA_FORMAT_TIFF)
        image.SaveFile(str(tiff_path))
        log.info(f'   TIFF saved ({tiff_path.stat().st_size // 1024} KB)')

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
            return paths, None
        except ImportError as error:
            log.error('Pillow not installed: pip install pillow')
            return paths, error
    except Exception as error:
        log.warning(f'⚠️ Multi-page TIFF failed: {error}')

    log.info('🔄 Falling back to single-page loop...')
    _set_property(device.Properties, WIA_DPS_PAGES, 1)

    page_num = 0
    last_error = None
    while page_num < max_pages:
        page_num += 1
        try:
            image = item.Transfer(WIA_FORMAT_JPEG)
            fp = output_dir / f'scan-{int(time.time() * 1000)}-{page_num}.jpg'
            image.SaveFile(str(fp))
            paths.append(fp)
            log.info(f'✅ Page {page_num}')
        except Exception as error:
            last_error = error
            if _is_wia_no_documents_error(error):
                log.info(f'📤 ADF finished — {page_num - 1} pages')
            else:
                log.error(f'❌ Page {page_num} error: {error}')
            break

    return paths, last_error


def scan_via_wia_multi(output_dir: Path, color: str = 'color', dpi: int = 200,
                       preferred_scanner: str = '', source: str = 'feeder',
                       duplex: bool = False, max_pages: int = 100) -> list:
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

        WIA_FORMAT_JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'

        output_dir.mkdir(parents=True, exist_ok=True)

        scanner_name = device_info.Properties('Name').Value
        log.info(f'🖨️ Using scanner: {scanner_name}')

        # For flatbed: only one page
        if source == 'flatbed':
            device = device_info.Connect()
            item = _select_source_item(device, 'flatbed')
            if item is None:
                log.error('❌ No WIA item available for flatbed scan')
                return paths
            _set_source_mode(device, item, 'flatbed', duplex)
            _apply_scan_properties(item, color, dpi)
            try:
                image = item.Transfer(WIA_FORMAT_JPEG)
                fp = output_dir / f'scan-{int(time.time() * 1000)}-1.jpg'
                image.SaveFile(str(fp))
                paths.append(fp)
                log.info(f'✅ Page 1 saved: {fp.name}')
            except Exception as e:
                log.error(f'❌ Flatbed scan error: {e}')
            return paths

        source_attempts = []
        if source == 'feeder':
            source_attempts.append(('feeder', 1 | 4 if duplex else 1))
            source_attempts.append(('feeder', None))
        else:
            source_attempts.append((source, None))

        last_error = None
        for index, (source_label, source_value) in enumerate(source_attempts, start=1):
            device = device_info.Connect()
            item = _select_source_item(device, source_label)
            if item is None:
                log.error('❌ No WIA item available for feeder scan')
                return paths

            if source_value is not None:
                forced = _set_source_mode(device, item, source_label, duplex)
                if not forced:
                    log.warning(f'⚠️ Could not force source {source_label} on attempt {index}')
            else:
                log.info(f'📥 Source: {source_label} | duplex={duplex} | attempt={index} (device default)')

            paths, last_error = _scan_batch_from_connected_item(device, item, output_dir, color, dpi, max_pages)
            if paths:
                return paths

            if source != 'feeder' or len(source_attempts) == index:
                break

            if last_error and _is_wia_no_documents_error(last_error):
                log.warning('⚠️ Explicit feeder mode failed, retrying with device default...')
                continue

            log.warning('⚠️ Feeder scan returned no pages, trying alternate feeder mode...')

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
                 preferred_scanner: str = '', source: str = 'feeder',
                 duplex: bool = False) -> Optional[Path]:
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
        item = _select_source_item(device, source)
        if item is None:
            log.error('❌ No WIA item available for scan request')
            return None

        _set_source_mode(device, item, source, duplex)
        _set_property(device.Properties, WIA_DPS_PAGES, 1)
        _apply_scan_properties(item, color, dpi)

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


def create_app(
    scan_token: str,
    scans_folder: Path,
    preferred_scanner: str = '',
    default_source: str = 'feeder',
    default_color: str = 'gray',
    default_dpi: int = 150,
    default_duplex: bool = False,
    default_max_pages: int = 100,
):
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

    @app.route('/settings', methods=['GET'])
    def settings():
        if request.headers.get('X-Scan-Token') != scan_token:
            return jsonify({'error': 'unauthorized'}), 401
        return jsonify({
            'preferred_scanner': preferred_scanner,
            'source': default_source,
            'color': default_color,
            'dpi': default_dpi,
            'duplex': default_duplex,
            'max_pages': default_max_pages,
        })

    @app.route('/scan-batch', methods=['POST', 'OPTIONS'])
    def scan_batch():
        """Scan all pages from feeder. Returns JSON with array of base64 images."""
        if request.method == 'OPTIONS':
            return '', 204

        if request.headers.get('X-Scan-Token') != scan_token:
            return jsonify({'error': 'unauthorized'}), 401

        body = request.get_json(silent=True) or {}
        color = body.get('color', default_color)
        dpi = int(body.get('dpi', default_dpi))
        source = body.get('source', default_source)
        duplex = bool(body.get('duplex', default_duplex))
        max_pages = int(body.get('max_pages', default_max_pages))

        log.info(f'📥 Batch scan: source={source}, color={color}, dpi={dpi}, duplex={duplex}, max_pages={max_pages}')

        tmp_dir = Path(tempfile.gettempdir()) / 'rawaes_scans'
        tmp_dir.mkdir(parents=True, exist_ok=True)

        if source == 'flatbed':
            single_path = scan_via_wia(
                tmp_dir,
                color=color,
                dpi=dpi,
                preferred_scanner=preferred_scanner,
                source=source,
                duplex=duplex,
            )
            paths = [single_path] if single_path else []
        else:
            paths = scan_via_wia_multi(
                tmp_dir, color=color, dpi=dpi,
                preferred_scanner=preferred_scanner, source=source,
                duplex=duplex, max_pages=max_pages,
            )

        if not paths:
            message = 'لم يتم مسح أي صفحة. تأكد من وجود ورق في الدرج وأن السكانر جاهز.'
            if source == 'flatbed':
                message = 'لم يتم مسح أي صفحة من الزجاج. تأكد أن الورقة موضوعة على الزجاج وأن السكانر جاهز.'
            return jsonify({
                'error': 'no_pages',
                'message': message,
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
        color = body.get('color', default_color)  # color | gray | bw
        dpi = int(body.get('dpi', default_dpi))
        source = body.get('source', default_source)  # feeder | flatbed | auto
        duplex = bool(body.get('duplex', default_duplex))

        log.info(f'📥 Scan request: source={source}, color={color}, dpi={dpi}, duplex={duplex}')

        # Use a unique temp file (not directory) to avoid cleanup issues on Windows
        import io, uuid
        tmp_dir = Path(tempfile.gettempdir()) / 'rawaes_scans'
        tmp_dir.mkdir(parents=True, exist_ok=True)

        filepath = scan_via_wia(
            tmp_dir,
            color=color,
            dpi=dpi,
            preferred_scanner=preferred_scanner,
            source=source,
            duplex=duplex,
        )
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


def run_bridge(
    scan_token: str,
    scans_folder: Path,
    port: int = 9999,
    preferred_scanner: str = '',
    default_source: str = 'feeder',
    default_color: str = 'gray',
    default_dpi: int = 150,
    default_duplex: bool = False,
    default_max_pages: int = 100,
):
    """Start the bridge in a background thread."""
    app = create_app(
        scan_token,
        scans_folder,
        preferred_scanner=preferred_scanner,
        default_source=default_source,
        default_color=default_color,
        default_dpi=default_dpi,
        default_duplex=default_duplex,
        default_max_pages=default_max_pages,
    )
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