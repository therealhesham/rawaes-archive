"""
Rawaes Watcher Desktop UI (Windows)
----------------------------------
Lightweight Tkinter GUI to configure and run watcher.py.

Goals:
- Show connection status (API ping)
- One-click start/stop watcher
- Select preferred scanner (WIA)
- Easy packaging to .exe via PyInstaller
"""

from __future__ import annotations

import configparser
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from tkinter import Tk, StringVar, BooleanVar, IntVar, ttk, messagebox, filedialog

import requests


APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "config.ini"
CONFIG_EXAMPLE_PATH = APP_DIR / "config.ini.example"
WATCHER_PATH = APP_DIR / "watcher.py"


def ensure_config_exists() -> None:
    if CONFIG_PATH.exists():
        return
    if CONFIG_EXAMPLE_PATH.exists():
        CONFIG_PATH.write_text(CONFIG_EXAMPLE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        CONFIG_PATH.write_text("[main]\n", encoding="utf-8")


def load_config() -> configparser.ConfigParser:
    ensure_config_exists()
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_PATH, encoding="utf-8")
    if "main" not in cfg:
        cfg["main"] = {}
    return cfg


def save_config(cfg: configparser.ConfigParser) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        cfg.write(f)


def ping_api(api_url: str, token: str) -> tuple[bool, str]:
    try:
        url = api_url.rstrip("/") + "/api/scans/ping"
        r = requests.get(url, headers={"X-Scan-Token": token}, timeout=8)
        if r.status_code == 200:
            return True, "متصل ✅"
        if r.status_code == 401:
            return False, "توكن غير صحيح ❌"
        return False, f"خطأ ({r.status_code})"
    except Exception as e:
        return False, f"غير متصل: {e}"


def list_scanners() -> list[str]:
    """
    Uses scan_bridge.list_scanners() if available. Falls back to empty list.
    """
    try:
        import scan_bridge  # type: ignore

        scanners = scan_bridge.list_scanners()
        return [s.get("name") for s in scanners if s.get("name")]
    except Exception:
        return []


class WatcherGUI:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("روائس - مراقب السكانر")
        self.root.geometry("720x520")

        self.cfg = load_config()

        main = self.cfg["main"]
        self.api_url = StringVar(value=main.get("api_url", "https://archive.rawaes.com"))
        self.api_token = StringVar(value=main.get("api_token", ""))
        self.device_name = StringVar(value=main.get("device_name", "Office-PC-1"))
        self.watch_folder = StringVar(value=main.get("watch_folder", r"C:\Scans"))

        self.bridge_enabled = BooleanVar(value=main.get("bridge_enabled", "true").lower() == "true")
        self.bridge_port = IntVar(value=int(main.get("bridge_port", "9999") or 9999))
        self.preferred_scanner = StringVar(value=main.get("preferred_scanner", ""))
        self.scan_source = StringVar(value=main.get("scan_source", "feeder"))

        self.batch_enabled = BooleanVar(value=main.get("batch_enabled", "true").lower() == "true")
        self.batch_window_seconds = IntVar(value=int(main.get("batch_window_seconds", "8") or 8))
        self.batch_min_files = IntVar(value=int(main.get("batch_min_files", "2") or 2))

        self.status_text = StringVar(value="غير متصل")
        self.watcher_state = StringVar(value="متوقف")

        self.proc: subprocess.Popen | None = None
        self._stop_status = False

        self._build_ui()
        self._start_status_loop()

    def _build_ui(self) -> None:
        pad = {"padx": 10, "pady": 6}

        header = ttk.Frame(self.root)
        header.pack(fill="x", **pad)

        ttk.Label(header, text="روائس - مراقب السكانر", font=("Segoe UI", 14, "bold")).pack(side="right")
        ttk.Label(header, textvariable=self.watcher_state, foreground="#0f766e").pack(side="left")

        # Connection box
        conn = ttk.LabelFrame(self.root, text="الاتصال بالنظام")
        conn.pack(fill="x", **pad)

        row = ttk.Frame(conn)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="رابط النظام").pack(side="right")
        ttk.Entry(row, textvariable=self.api_url, width=50).pack(side="right", padx=8)
        ttk.Button(row, text="اختبار اتصال", command=self.on_test_connection).pack(side="left")

        row = ttk.Frame(conn)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="API Token").pack(side="right")
        ttk.Entry(row, textvariable=self.api_token, width=50, show="•").pack(side="right", padx=8)
        ttk.Label(row, textvariable=self.status_text).pack(side="left")

        # Settings box
        settings = ttk.LabelFrame(self.root, text="الإعدادات")
        settings.pack(fill="x", **pad)

        row = ttk.Frame(settings)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="اسم الجهاز").pack(side="right")
        ttk.Entry(row, textvariable=self.device_name, width=30).pack(side="right", padx=8)

        row = ttk.Frame(settings)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="مجلد المراقبة").pack(side="right")
        ttk.Entry(row, textvariable=self.watch_folder, width=45).pack(side="right", padx=8)
        ttk.Button(row, text="اختيار...", command=self.on_pick_folder).pack(side="left")

        row = ttk.Frame(settings)
        row.pack(fill="x", **pad)
        ttk.Checkbutton(row, text="تفعيل الجسر المحلي (مسح من المتصفح)", variable=self.bridge_enabled).pack(side="right")
        ttk.Label(row, text="Port").pack(side="right", padx=(20, 6))
        ttk.Entry(row, textvariable=self.bridge_port, width=8).pack(side="right")

        row = ttk.Frame(settings)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="مصدر المسح").pack(side="right")
        ttk.Combobox(row, textvariable=self.scan_source, values=["feeder", "flatbed"], state="readonly", width=12).pack(side="right", padx=8)

        row = ttk.Frame(settings)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="السكانر المفضل").pack(side="right")
        self.scanner_combo = ttk.Combobox(row, textvariable=self.preferred_scanner, values=[], width=45)
        self.scanner_combo.pack(side="right", padx=8)
        ttk.Button(row, text="جلب قائمة السكانرات", command=self.on_refresh_scanners).pack(side="left")

        # Batch
        batch = ttk.LabelFrame(self.root, text="دمج الصفحات (Batch)")
        batch.pack(fill="x", **pad)
        row = ttk.Frame(batch)
        row.pack(fill="x", **pad)
        ttk.Checkbutton(row, text="دمج الصفحات إلى PDF واحد", variable=self.batch_enabled).pack(side="right")
        ttk.Label(row, text="نافذة التجميع (ثانية)").pack(side="right", padx=(20, 6))
        ttk.Entry(row, textvariable=self.batch_window_seconds, width=6).pack(side="right")
        ttk.Label(row, text="أقل عدد صفحات").pack(side="right", padx=(20, 6))
        ttk.Entry(row, textvariable=self.batch_min_files, width=6).pack(side="right")

        # Actions
        actions = ttk.Frame(self.root)
        actions.pack(fill="x", **pad)
        ttk.Button(actions, text="حفظ الإعدادات", command=self.on_save).pack(side="right")
        ttk.Button(actions, text="تشغيل", command=self.on_start, width=14).pack(side="left", padx=6)
        ttk.Button(actions, text="إيقاف", command=self.on_stop, width=14).pack(side="left")

        # Notes
        note = ttk.LabelFrame(self.root, text="ملاحظات")
        note.pack(fill="both", expand=True, **pad)
        msg = (
            "- هذا البرنامج يشغّل watcher.py في الخلفية.\n"
            "- لتجميع 20 ورقة في ملف واحد: ضعها في ADF + تأكد أن السكانر يحفظ صور صفحة-صفحة داخل watch_folder.\n"
            "- تأكد تثبيت Python + المكتبات: requests watchdog flask flask-cors pywin32 pillow.\n"
        )
        ttk.Label(note, text=msg, justify="right").pack(anchor="ne", padx=10, pady=10)

    def on_pick_folder(self) -> None:
        path = filedialog.askdirectory()
        if path:
            self.watch_folder.set(path)

    def on_refresh_scanners(self) -> None:
        scanners = list_scanners()
        if not scanners:
            messagebox.showwarning("تنبيه", "لم يتم العثور على سكانرات (تأكد من pywin32 والسكانر WIA).")
        self.scanner_combo["values"] = scanners
        if scanners and not self.preferred_scanner.get():
            self.preferred_scanner.set(scanners[0])

    def on_save(self) -> None:
        main = self.cfg["main"]
        main["api_url"] = self.api_url.get().strip()
        main["api_token"] = self.api_token.get().strip()
        main["device_name"] = self.device_name.get().strip()
        main["watch_folder"] = self.watch_folder.get().strip()
        main["bridge_enabled"] = "true" if self.bridge_enabled.get() else "false"
        main["bridge_port"] = str(self.bridge_port.get())
        main["preferred_scanner"] = self.preferred_scanner.get().strip()
        main["scan_source"] = self.scan_source.get().strip()

        main["batch_enabled"] = "true" if self.batch_enabled.get() else "false"
        main["batch_window_seconds"] = str(self.batch_window_seconds.get())
        main["batch_min_files"] = str(self.batch_min_files.get())

        save_config(self.cfg)
        messagebox.showinfo("تم", "تم حفظ الإعدادات بنجاح.")

    def on_test_connection(self) -> None:
        ok, msg = ping_api(self.api_url.get(), self.api_token.get())
        self.status_text.set(msg)
        if ok:
            self.status_text.set("متصل ✅")

    def on_start(self) -> None:
        if self.proc and self.proc.poll() is None:
            messagebox.showinfo("معلومة", "المراقب يعمل بالفعل.")
            return

        self.on_save()

        if not WATCHER_PATH.exists():
            messagebox.showerror("خطأ", f"لم يتم العثور على {WATCHER_PATH}")
            return

        cmd = [sys.executable, str(WATCHER_PATH)]
        self.proc = subprocess.Popen(
            cmd,
            cwd=str(APP_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self.watcher_state.set("يعمل ✅")

    def on_stop(self) -> None:
        if not self.proc or self.proc.poll() is not None:
            self.watcher_state.set("متوقف")
            return

        try:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=4)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        finally:
            self.proc = None
            self.watcher_state.set("متوقف")

    def _start_status_loop(self) -> None:
        def loop():
            while not self._stop_status:
                ok, msg = ping_api(self.api_url.get(), self.api_token.get())
                self.status_text.set(msg)
                time.sleep(8)

        t = threading.Thread(target=loop, daemon=True)
        t.start()

    def run(self) -> None:
        def on_close():
            self._stop_status = True
            try:
                self.on_stop()
            finally:
                self.root.destroy()

        self.root.protocol("WM_DELETE_WINDOW", on_close)
        self.root.mainloop()


def main() -> None:
    gui = WatcherGUI()
    gui.run()


if __name__ == "__main__":
    main()

