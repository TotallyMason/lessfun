#!/usr/bin/env python3
"""
LessFun Browser — a dedicated PyQt6 shell for the LessFun web arcade.

Only pages under https://totallymason.github.io/lessfun/ are allowed in the
window. External links are handed to the default macOS browser.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PyQt6.QtCore import QSize, Qt, QUrl
from PyQt6.QtGui import QAction, QDesktopServices, QIcon, QKeySequence
from PyQt6.QtWidgets import (
    QApplication,
    QLabel,
    QMainWindow,
    QMenu,
    QProgressBar,
    QSizePolicy,
    QStackedWidget,
    QToolBar,
    QToolButton,
    QVBoxLayout,
    QWidget,
)
from PyQt6.QtWebEngineCore import (
    QWebEngineDownloadRequest,
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineScript,
    QWebEngineSettings,
)
from PyQt6.QtWebEngineWidgets import QWebEngineView

HOME_URL = "https://totallymason.github.io/lessfun/"
ALLOWED_HOSTS = {"totallymason.github.io"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
APP_NAME = "LessFun"
APP_ID = "com.totallymason.lessfun.browser"


def data_dir() -> Path:
    path = Path.home() / "Library" / "Application Support" / "LessFun Browser"
    path.mkdir(parents=True, exist_ok=True)
    return path


def is_lessfun_url(url: QUrl) -> bool:
    if not url.isValid():
        return False
    scheme = url.scheme().lower()
    if scheme in ("about", "data", "blob"):
        return True
    if scheme not in ("http", "https"):
        return False
    host = url.host().lower()
    if host in LOCAL_HOSTS:
        return True
    if host in ALLOWED_HOSTS:
        path = url.path() or "/"
        return path == "/lessfun" or path.startswith("/lessfun/")
    return False


class LessFunPage(QWebEnginePage):
    """A page that keeps LessFun in-window and sends everything else out."""

    def __init__(self, profile: QWebEngineProfile, parent: QWidget | None = None):
        super().__init__(profile, parent)
        self._main_view: QWebEngineView | None = None

    def attach_view(self, view: QWebEngineView) -> None:
        self._main_view = view

    def acceptNavigationRequest(self, url: QUrl, nav_type, is_main_frame: bool) -> bool:
        # Keep normal web navigation inside the app. The Google button and any
        # other link should load in this window instead of failing or being
        # pushed out to another browser.
        if url.scheme() in ("http", "https"):
            return True
        if is_lessfun_url(url):
            return True
        if url.scheme() == "mailto":
            QDesktopServices.openUrl(url)
        return False

    def createWindow(self, window_type):  # target="_blank" stays in this app
        return self


PHONE_DEVICES = {
    "samsung-a54": {
        "label": "Samsung Galaxy A54 5G",
        "width": 412,
        "height": 915,
        "dpr": 2.625,
        "ua": "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    },
    "iphone-13": {
        "label": "iPhone 13",
        "width": 390,
        "height": 844,
        "dpr": 3.0,
        "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    },
    "pixel-9": {
        "label": "Google Pixel 9",
        "width": 412,
        "height": 923,
        "dpr": 2.625,
        "ua": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    },
}


class PhoneTestWindow(QMainWindow):
    """A phone-sized LessFun window with a mobile UA and touch/DPR spoofing."""

    def __init__(self, device_key: str, parent: QWidget | None = None):
        super().__init__(parent)
        self.device_key = device_key
        self.device = PHONE_DEVICES[device_key]
        self.setWindowTitle(f"{self.device['label']} · LessFun Phone Test")
        self.setFixedSize(self.device["width"], self.device["height"] + 44)

        self.profile = QWebEngineProfile(f"PhoneTest-{device_key}", self)
        self.profile.setHttpUserAgent(self.device["ua"])
        self.profile.downloadRequested.connect(self._on_download)

        self.page = LessFunPage(self.profile, self)
        self.view = QWebEngineView(self)
        self.view.setPage(self.page)
        self.page.attach_view(self.view)
        settings = self.page.settings()
        for attr, enabled in (
            (QWebEngineSettings.WebAttribute.JavascriptEnabled, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True),
            (QWebEngineSettings.WebAttribute.LocalStorageEnabled, True),
            (QWebEngineSettings.WebAttribute.WebGLEnabled, True),
            (QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True),
            (QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False),
            (QWebEngineSettings.WebAttribute.TouchEventsApiEnabled, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanPaste, True),
        ):
            try:
                settings.setAttribute(attr, enabled)
            except Exception:
                pass

        self.page.featurePermissionRequested.connect(self._on_feature_permission)
        self.page.fullScreenRequested.connect(lambda req: (req.accept(), self.showFullScreen() if req.toggleOn() else self.showNormal()))
        self._install_spoof_script()

        toolbar = QToolBar("Phone Test", self)
        toolbar.setMovable(False)
        toolbar.setFloatable(False)
        toolbar.setStyleSheet(
            "QToolBar { spacing: 6px; padding: 5px 8px; background: #0b0f14; border: 0; }"
            "QToolButton { color: #dff6ff; background: transparent; border: 1px solid rgba(95,224,255,0.2);"
            " border-radius: 7px; padding: 5px 9px; font-size: 11px; font-weight: 600; }"
            "QToolButton:hover { background: rgba(95,224,255,0.12); }"
        )
        self.addToolBar(Qt.ToolBarArea.TopToolBarArea, toolbar)
        toolbar.addWidget(QLabel(f"  {self.device['label']}  ", self))
        home = QAction("Home", self); home.triggered.connect(lambda: self.view.load(QUrl(HOME_URL)))
        reload = QAction("Reload", self); reload.triggered.connect(self.view.reload)
        close = QAction("Close", self); close.triggered.connect(self.close)
        toolbar.addAction(home); toolbar.addAction(reload)
        spacer = QWidget(self); spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        toolbar.addWidget(spacer); toolbar.addAction(close)

        self.setCentralWidget(self.view)
        self.view.load(QUrl(HOME_URL))

    def _install_spoof_script(self) -> None:
        script = QWebEngineScript()
        script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentCreation)
        script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
        script.setRunsOnSubFrames(True)
        dpr = self.device["dpr"]
        script.setSourceCode(f"""
(function() {{
  try {{
    Object.defineProperty(window, 'devicePixelRatio', {{ get: function() {{ return {dpr}; }}, configurable: true }});
  }} catch (e) {{}}
  try {{
    Object.defineProperty(navigator, 'maxTouchPoints', {{ get: function() {{ return 5; }}, configurable: true }});
  }} catch (e) {{}}
  var _mm = window.matchMedia ? window.matchMedia.bind(window) : null;
  if (_mm) {{
    window.matchMedia = function(q) {{
      if (q.indexOf('pointer: coarse') >= 0 || q.indexOf('hover: none') >= 0) {{
        return {{ matches: true, media: q, onchange: null, addListener: function() {{}}, removeListener: function() {{}}, addEventListener: function() {{}}, removeEventListener: function() {{}}, dispatchEvent: function() {{ return false; }} }};
      }}
      return _mm(q);
    }};
  }}
  window.ontouchstart = null;
}})();
""")
        self.page.scripts().insert(script)

    def _on_feature_permission(self, origin: QUrl, feature) -> None:
        policy = (
            QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
            if feature == QWebEnginePage.Feature.MouseLock
            else QWebEnginePage.PermissionPolicy.PermissionDeniedByUser
        )
        self.page.setFeaturePermission(origin, feature, policy)

    def _on_download(self, download: QWebEngineDownloadRequest) -> None:
        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        download.setDownloadDirectory(str(downloads))
        download.setDownloadFileName(download.suggestedFileName() or "lessfun-download")
        download.accept()


class PhoneFrameWidget(QWidget):
    """Embedded phone mockup: mobile web view, bezel, notch or camera hole."""

    def __init__(self, device_key: str, parent: QWidget | None = None):
        super().__init__(parent)
        self.device_key = device_key
        self.device = PHONE_DEVICES[device_key]
        parent_w = max(360, parent.width() if parent else 900)
        parent_h = max(520, parent.height() if parent else 760)
        scale = min(1.0, (parent_w - 80) / self.device["width"], (parent_h - 110) / self.device["height"])
        self.scale = max(0.35, scale)
        self.view_w = max(260, round(self.device["width"] * self.scale))
        self.view_h = max(480, round(self.device["height"] * self.scale))
        self.setFixedSize(self.view_w + 20, self.view_h + 20)
        self.setStyleSheet("background:#05070a; border-radius:40px;")

        self.profile = QWebEngineProfile(f"PhoneFrame-{device_key}", self)
        self.profile.setHttpUserAgent(self.device["ua"])
        self.profile.downloadRequested.connect(self._on_download)

        self.page = LessFunPage(self.profile, self)
        self.view = QWebEngineView(self)
        self.view.setPage(self.page)
        self.page.attach_view(self.view)
        self.view.setGeometry(10, 10, self.view_w, self.view_h)
        settings = self.page.settings()
        for attr, enabled in (
            (QWebEngineSettings.WebAttribute.JavascriptEnabled, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True),
            (QWebEngineSettings.WebAttribute.LocalStorageEnabled, True),
            (QWebEngineSettings.WebAttribute.WebGLEnabled, True),
            (QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True),
            (QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False),
            (QWebEngineSettings.WebAttribute.TouchEventsApiEnabled, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanPaste, True),
        ):
            try:
                settings.setAttribute(attr, enabled)
            except Exception:
                pass
        self.page.featurePermissionRequested.connect(self._on_feature_permission)
        self.page.fullScreenRequested.connect(lambda req: (req.accept(), self.window().showFullScreen() if req.toggleOn() else self.window().showNormal()))
        self._install_spoof_script()
        self._build_chrome()
        self.view.load(QUrl(HOME_URL))

    def _build_chrome(self) -> None:
        bezel = QWidget(self)
        bezel.setGeometry(0, 0, self.width(), self.height())
        bezel.setStyleSheet("background:transparent; border:10px solid #05070a; border-radius:40px;")
        bezel.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        bezel.raise_()

        top = 10
        if self.device_key == "iphone-13":
            notch_w = max(110, round(self.view_w * 0.42))
            notch_h = max(18, round(24 * self.scale))
            notch = QWidget(self)
            notch.setGeometry(10 + (self.view_w - notch_w) // 2, top, notch_w, notch_h)
            notch.setStyleSheet("background:#000; border-radius:0 0 14px 14px; border:1px solid #090909;")
            notch.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            speaker = QWidget(notch)
            speaker.setGeometry(round(notch_w * 0.34), round(notch_h * 0.42), round(notch_w * 0.32), max(2, round(3 * self.scale)))
            speaker.setStyleSheet("background:#101418; border-radius:2px;")
            notch.raise_()
            home = QWidget(self)
            home.setGeometry(10 + round(self.view_w * 0.33), 10 + self.view_h - max(6, round(8 * self.scale)), round(self.view_w * 0.34), max(3, round(4 * self.scale)))
            home.setStyleSheet("background:rgba(240,250,255,0.62); border-radius:2px;")
            home.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            home.raise_()
        else:
            dot = max(8, round(13 * self.scale))
            hole = QWidget(self)
            hole.setGeometry(10 + (self.view_w - dot) // 2, top + max(5, round(7 * self.scale)), dot, dot)
            hole.setStyleSheet("background:#000; border-radius:%dpx; border:1px solid #171b20;" % (dot // 2))
            hole.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            lens = QWidget(hole)
            lens.setGeometry(max(2, dot // 3), max(2, dot // 3), max(2, dot // 4), max(2, dot // 4))
            lens.setStyleSheet("background:#162736; border-radius:%dpx;" % max(1, dot // 8))
            hole.raise_()

    def _install_spoof_script(self) -> None:
        script = QWebEngineScript()
        script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentCreation)
        script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
        script.setRunsOnSubFrames(True)
        dpr = self.device["dpr"]
        script.setSourceCode(f"""
(function() {{
  try {{ Object.defineProperty(window, 'devicePixelRatio', {{ get: function() {{ return {dpr}; }}, configurable: true }}); }} catch (e) {{}}
  try {{ Object.defineProperty(navigator, 'maxTouchPoints', {{ get: function() {{ return 5; }}, configurable: true }}); }} catch (e) {{}}
  var _mm = window.matchMedia ? window.matchMedia.bind(window) : null;
  if (_mm) {{
    window.matchMedia = function(q) {{
      if (q.indexOf('pointer: coarse') >= 0 || q.indexOf('hover: none') >= 0) {{
        return {{ matches: true, media: q, onchange: null, addListener: function() {{}}, removeListener: function() {{}}, addEventListener: function() {{}}, removeEventListener: function() {{}}, dispatchEvent: function() {{ return false; }} }};
      }}
      return _mm(q);
    }};
  }}
  window.ontouchstart = null;
}})();
""")
        self.page.scripts().insert(script)

    def _on_feature_permission(self, origin: QUrl, feature) -> None:
        policy = (
            QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
            if feature == QWebEnginePage.Feature.MouseLock
            else QWebEnginePage.PermissionPolicy.PermissionDeniedByUser
        )
        self.page.setFeaturePermission(origin, feature, policy)

    def _on_download(self, download: QWebEngineDownloadRequest) -> None:
        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        download.setDownloadDirectory(str(downloads))
        download.setDownloadFileName(download.suggestedFileName() or "lessfun-download")
        download.accept()


class LessFunBrowser(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.setMinimumSize(QSize(960, 620))
        self.resize(1280, 820)
        self.setWindowIcon(QIcon.fromTheme("applications-games"))

        self._fullscreen_from_page = False
        self._build_profile()
        self._build_ui()
        self._build_shortcuts()
        self._restore_geometry()
        self.view.load(QUrl(HOME_URL))

    # ------------------------------------------------------------------ setup
    def _build_profile(self) -> None:
        root = data_dir()
        self.profile = QWebEngineProfile("LessFun", self)
        self.profile.setPersistentStoragePath(str(root / "profile"))
        self.profile.setCachePath(str(root / "cache"))
        self.profile.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies
        )
        self.profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.DiskHttpCache)
        self.profile.setHttpCacheMaximumSize(256 * 1024 * 1024)
        self.profile.downloadRequested.connect(self._on_download)

    def _build_ui(self) -> None:
        self.page = LessFunPage(self.profile, self)
        self.view = QWebEngineView(self)
        self.view.setPage(self.page)
        self.page.attach_view(self.view)
        settings = self.page.settings()
        for attr, enabled in (
            (QWebEngineSettings.WebAttribute.JavascriptEnabled, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True),
            (QWebEngineSettings.WebAttribute.LocalStorageEnabled, True),
            (QWebEngineSettings.WebAttribute.WebGLEnabled, True),
            (QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True),
            (QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False),
            (QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True),
            (QWebEngineSettings.WebAttribute.JavascriptCanPaste, True),
            (QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True),
        ):
            try:
                settings.setAttribute(attr, enabled)
            except Exception:
                pass

        self.page.fullScreenRequested.connect(self._on_fullscreen_requested)
        self.page.featurePermissionRequested.connect(self._on_feature_permission)
        self.page.loadProgress.connect(self._on_progress)
        self.page.loadFinished.connect(self._on_load_finished)
        self._healing = False
        self._heal_count = 0
        self.page.titleChanged.connect(self._on_title_changed)
        self.view.urlChanged.connect(self._on_url_changed)

        toolbar = QToolBar("LessFun", self)
        toolbar.setMovable(False)
        toolbar.setFloatable(False)
        toolbar.setIconSize(QSize(18, 18))
        toolbar.setStyleSheet(
            "QToolBar { spacing: 6px; padding: 5px 8px; background: #0b0f14; border: 0; }"
            "QToolButton { color: #dff6ff; background: transparent; border: 1px solid transparent;"
            " border-radius: 7px; padding: 5px 9px; font-size: 12px; font-weight: 600; }"
            "QToolButton:hover { background: rgba(95,224,255,0.12); border-color: rgba(95,224,255,0.35); }"
            "QToolButton:pressed { background: rgba(95,224,255,0.22); }"
            "QToolButton:disabled { color: rgba(255,255,255,0.25); }"
        )
        self.addToolBar(Qt.ToolBarArea.TopToolBarArea, toolbar)

        self.back_action = QAction("‹", self)
        self.back_action.setToolTip("Back (⌘[)")
        self.back_action.triggered.connect(self.view.back)
        self.forward_action = QAction("›", self)
        self.forward_action.setToolTip("Forward (⌘])")
        self.forward_action.triggered.connect(self.view.forward)
        self.hard_reload_action = QAction("Hard Reload", self)
        self.hard_reload_action.setToolTip("Clear cache and reload (⌘⇧R)")
        self.reload_action = QAction("Reload", self)
        self.reload_action.setToolTip("Reload (⌘R)")
        self.reload_action.triggered.connect(self.view.reload)
        self.home_action = QAction("Home", self)
        self.home_action.setToolTip("LessFun home")
        self.home_action.triggered.connect(lambda: self.view.load(QUrl(HOME_URL)))
        self.fullscreen_action = QAction("Full Screen", self)
        self.fullscreen_action.setToolTip("Full screen (⌃⌘F)")
        self.fullscreen_action.triggered.connect(self.toggle_fullscreen)
        self.phone_action = QAction("Phone", self)
        self.phone_action.setToolTip("Test LessFun in a simulated phone")
        self.phone_action.triggered.connect(self.show_phone_menu)
        self.exit_phone_action = QAction("Exit Phone", self)
        self.exit_phone_action.setToolTip("Return to the normal browser (Esc)")
        self.exit_phone_action.triggered.connect(self.exit_phone_mode)
        self.exit_phone_action.setVisible(False)

        toolbar.addAction(self.back_action)
        toolbar.addAction(self.forward_action)
        toolbar.addAction(self.reload_action)
        toolbar.addAction(self.hard_reload_action)
        toolbar.addAction(self.home_action)

        spacer = QWidget(self)
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        toolbar.addWidget(spacer)

        brand = QLabel("LessFun", self)
        brand.setStyleSheet("color:#9fe8ff; font-weight:800; letter-spacing:0.18em; font-size:11px;")
        toolbar.addWidget(brand)
        toolbar.addAction(self.fullscreen_action)
        toolbar.addAction(self.phone_action)
        toolbar.addAction(self.exit_phone_action)

        self.phone_frame = None
        self.phone_page = None
        self.stack = QStackedWidget(self)
        self.stack.addWidget(self.view)
        self.setCentralWidget(self.stack)

        self.status = self.statusBar()
        self.status.setStyleSheet("QStatusBar { background:#0b0f14; color:#9fb8c8; font-size:10px; }")
        self.progress = QProgressBar(self)
        self.progress.setMaximumWidth(140)
        self.progress.setMaximumHeight(6)
        self.progress.setTextVisible(False)
        self.progress.setStyleSheet(
            "QProgressBar { background: rgba(255,255,255,0.06); border:0; border-radius:3px; }"
            "QProgressBar::chunk { background:#5fe0ff; border-radius:3px; }"
        )
        self.status.addPermanentWidget(self.progress)
        self._update_nav()

    def _build_shortcuts(self) -> None:
        shortcuts = (
            (QKeySequence.StandardKey.Back, self.view.back),
            (QKeySequence.StandardKey.Forward, self.view.forward),
            (QKeySequence.StandardKey.Refresh, self.view.reload),
            (QKeySequence("Ctrl+Home"), lambda: self.view.load(QUrl(HOME_URL))),
            (QKeySequence("Ctrl+Shift+R"), self.hard_reload),
            (QKeySequence("Ctrl+Shift+F"), self.toggle_fullscreen),
            (QKeySequence("Ctrl+0"), lambda: self.view.setZoomFactor(1.0)),
            (QKeySequence("Ctrl+="), lambda: self.view.setZoomFactor(min(2.0, self.view.zoomFactor() + 0.1))),
            (QKeySequence("Ctrl+-"), lambda: self.view.setZoomFactor(max(0.5, self.view.zoomFactor() - 0.1))),
        )
        for seq, handler in shortcuts:
            action = QAction(self)
            action.setShortcut(seq)
            action.triggered.connect(handler)
            self.addAction(action)

    # --------------------------------------------------------------- behavior
    def show_phone_menu(self) -> None:
        menu = QMenu(self)
        for key, device in PHONE_DEVICES.items():
            action = menu.addAction(device["label"])
            action.triggered.connect(lambda checked=False, k=key: self.open_phone_test(k))
        menu.exec(self.cursor().pos())

    def open_phone_test(self, device_key: str) -> None:
        self.enter_phone_mode(device_key)

    def enter_phone_mode(self, device_key: str) -> None:
        if device_key not in PHONE_DEVICES:
            return
        self.exit_phone_mode(silent=True)
        self.phone_frame = PhoneFrameWidget(device_key, self)
        self.phone_page = QWidget(self)
        layout = QVBoxLayout(self.phone_page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.addStretch(1)
        layout.addWidget(self.phone_frame, 0, Qt.AlignmentFlag.AlignCenter)
        layout.addStretch(1)
        self.phone_page.setStyleSheet("background: radial-gradient(circle at 50% 28%, #122433, #06090e 70%);")
        self.stack.addWidget(self.phone_page)
        self.stack.setCurrentWidget(self.phone_page)
        self.exit_phone_action.setVisible(True)
        self.setWindowTitle(f"{PHONE_DEVICES[device_key]['label']} · LessFun")
        self.status.showMessage(f"{PHONE_DEVICES[device_key]['label']} simulated · press Esc to exit", 6000)

    def exit_phone_mode(self, silent: bool = False) -> None:
        if self.stack.currentWidget() is not self.view:
            self.stack.setCurrentWidget(self.view)
        if self.phone_page is not None:
            self.stack.removeWidget(self.phone_page)
            self.phone_page.deleteLater()
            self.phone_page = None
        self.phone_frame = None
        self.exit_phone_action.setVisible(False)
        self.setWindowTitle(APP_NAME)
        if not silent:
            self.status.showMessage("Returned to normal browser", 2500)

    def _on_download(self, download: QWebEngineDownloadRequest) -> None:
        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        suggested = download.suggestedFileName() or "lessfun-download"
        download.setDownloadDirectory(str(downloads))
        download.setDownloadFileName(suggested)
        download.accept()

    def _on_feature_permission(self, origin: QUrl, feature) -> None:
        # Pointer lock is what lets Dead Coast capture the mouse for aim.
        if feature == QWebEnginePage.Feature.MouseLock:
            self.page.setFeaturePermission(
                origin,
                feature,
                QWebEnginePage.PermissionPolicy.PermissionGrantedByUser,
            )
        else:
            self.page.setFeaturePermission(
                origin,
                feature,
                QWebEnginePage.PermissionPolicy.PermissionDeniedByUser,
            )

    def _on_fullscreen_requested(self, request) -> None:
        request.accept()
        self._fullscreen_from_page = bool(request.toggleOn())
        if self._fullscreen_from_page:
            self.showFullScreen()
        else:
            self.showNormal()

    def _on_progress(self, value: int) -> None:
        if value <= 0 or value >= 100:
            self.progress.hide()
        else:
            self.progress.show()
            self.progress.setValue(value)

    def _on_load_finished(self, ok: bool) -> None:
        self.progress.hide()
        self._check_version_heal()
        if not ok:
            self.status.showMessage("Could not load page. Check your connection and press ⌘R.", 8000)
        else:
            self.status.showMessage("Page ready", 2500)
        self._update_nav()

    def _on_title_changed(self, title: str) -> None:
        self.setWindowTitle(f"{title} — LessFun" if title and title != "LessFun" else "LessFun")

    def _on_url_changed(self, url: QUrl) -> None:
        self._update_nav()

    def hard_reload(self) -> None:
        """Drop the HTTP cache so a fresh build always lands."""
        try:
            self.profile.clearHttpCache()
            self.status.showMessage("Cache cleared - reloading", 4000)
        except Exception:
            self.status.showMessage("Reloading", 2000)
        self.view.reload()

    def _check_version_heal(self) -> None:
        """Auto-heal: if the page runs a different build than the live site,
        clear the HTTP cache and reload once. No user interaction needed."""
        if self._healing or self._heal_count >= 3:
            return
        if not is_lessfun_url(self.view.url()):
            return
        js = (
            "(function(){"
            "return fetch('version.json?t=' + Date.now(), {cache:'no-store'})"
            ".then(function(r){ return r.ok ? r.json() : null; })"
            ".then(function(d){ return JSON.stringify({remote: (d && d.version) || null, local: window.APP_VERSION || null}); })"
            ".catch(function(){ return JSON.stringify({remote:null, local:null}); });"
            "})()"
        )
        self.page.runJavaScript(js, self._version_heal_result)

    def _version_heal_result(self, result) -> None:
        try:
            data = json.loads(result) if isinstance(result, str) else (result or {})
        except Exception:
            return
        remote = (data or {}).get('remote')
        local = (data or {}).get('local')
        if not remote or not local:
            return
        if remote == local:
            self._heal_count = 0
            return
        self._healing = True
        self._heal_count += 1
        self.status.showMessage('Newer build detected - clearing cache and reloading...', 8000)
        try:
            self.profile.clearHttpCache()
        except Exception:
            pass
        self.view.reload()
        self._healing = False

    def _update_nav(self) -> None:
        history = self.page.history()
        self.back_action.setEnabled(history.canGoBack())
        self.forward_action.setEnabled(history.canGoForward())
        self.reload_action.setText("Stop" if self.page.isLoading() else "Reload")
        try:
            self.reload_action.triggered.disconnect()
        except Exception:
            pass
        self.reload_action.triggered.connect(lambda: self.view.stop() if self.page.isLoading() else self.view.reload())

    def toggle_fullscreen(self) -> None:
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key.Key_Escape and self.phone_page is not None:
            self.exit_phone_mode()
            event.accept()
            return
        if event.key() == Qt.Key.Key_Escape and self.isFullScreen():
            self.showNormal()
            event.accept()
            return
        super().keyPressEvent(event)

    def closeEvent(self, event) -> None:
        root = data_dir()
        (root / "geometry.bin").write_bytes(bytes(self.saveGeometry()))
        super().closeEvent(event)

    def _restore_geometry(self) -> None:
        root = data_dir()
        geometry = root / "geometry.bin"
        if geometry.exists():
            try:
                self.restoreGeometry(geometry.read_bytes())
            except Exception:
                pass


def main() -> int:
    os.environ.setdefault('QTWEBENGINE_REMOTE_DEBUGGING', '127.0.0.1:9223')
    QApplication.setApplicationName(APP_NAME)
    QApplication.setApplicationDisplayName(APP_NAME)
    QApplication.setOrganizationName("TotallyMason")
    QApplication.setOrganizationDomain("totallymason.github.io")
    app = QApplication(sys.argv)
    app.setApplicationDisplayName(APP_NAME)
    window = LessFunBrowser()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
