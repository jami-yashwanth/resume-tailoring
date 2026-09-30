"""Prints the web app's HTML resume to an A4 PDF with headless Chromium.

One Chromium is launched lazily and shared; every call gets its own context,
so nothing (cookies, cache, pages) survives between resumes. The page is
self-contained by contract, so the network is cut off entirely: a stray
`<img src>` or `@import` in user text can never make this service fetch a URL.
"""
import asyncio

from playwright.async_api import Browser, Playwright, async_playwright
from playwright.async_api import Error as PlaywrightError


class PrintError(Exception):
    """Chromium could not produce a PDF; the caller falls back to drawing."""


#: How long the timeout path waits for a wedged browser to close before
#: giving up on it; the print timeout must not be doubled by close().
CLOSE_TIMEOUT = 5.0

#: Containers give /dev/shm 64 MB, which Chromium overflows on a long page;
#: this makes it use /tmp instead.
LAUNCH_ARGS = ["--disable-dev-shm-usage"]

_lock = asyncio.Lock()
_playwright: Playwright | None = None
_browser: Browser | None = None


async def _get_browser(fresh: bool = False) -> Browser:
    global _playwright, _browser
    async with _lock:
        if fresh:
            await _close()
        if _browser is None:
            _playwright = await async_playwright().start()
            try:
                _browser = await _playwright.chromium.launch(args=LAUNCH_ARGS)
            except BaseException:
                # Chromium missing or unlaunchable: stop the driver we just
                # started, or every request leaks a node process.
                await _close()
                raise
        return _browser


async def _close() -> None:
    # Callers hold the lock. Each step is best effort: a dead browser must
    # not stop the relaunch.
    global _playwright, _browser
    browser, playwright = _browser, _playwright
    _browser = _playwright = None
    for closer in (browser and browser.close, playwright and playwright.stop):
        if closer:
            try:
                await closer()
            except Exception:
                pass


async def _print(html: str) -> bytes:
    browser = await _get_browser()
    try:
        context = await browser.new_context()
    except Exception:
        # The shared browser died since the last call: relaunch once.
        browser = await _get_browser(fresh=True)
        context = await browser.new_context()
    try:
        page = await context.new_page()
        await page.route("**/*", lambda route: route.abort())
        await page.set_content(html, wait_until="load")
        # Fonts arrive as data URIs; print before they decode and the page
        # would set in the fallback serif.
        await page.evaluate("document.fonts.ready")
        return await page.pdf(format="A4", prefer_css_page_size=True, print_background=True)
    finally:
        # Bounded: a wedged browser can hang close(), which would defeat the
        # print timeout.
        try:
            await asyncio.wait_for(context.close(), 2)
        except Exception:
            pass


async def print_html(html: str, timeout: float = 15.0) -> bytes:
    try:
        return await asyncio.wait_for(_print(html), timeout)
    except PrintError:
        raise
    except asyncio.TimeoutError as exc:
        # A browser that timed out is presumed wedged; the next call gets a
        # fresh one instead of waiting out another timeout.
        async with _lock:
            try:
                await asyncio.wait_for(_close(), CLOSE_TIMEOUT)
            except asyncio.TimeoutError:
                # _close() cleared the globals first; the stuck process is
                # abandoned and the next call launches a fresh one.
                pass
        raise PrintError(f"chromium timed out after {timeout:g}s") from exc
    except (PlaywrightError, OSError) as exc:
        raise PrintError(f"chromium failed: {exc}") from exc
    except Exception as exc:  # a bug here must fall back, never 500
        raise PrintError(f"unexpected print failure: {exc!r}") from exc


def available() -> bool:
    """Whether a Chromium build is installed — a cheap, non-launching check for /health."""
    import os
    from pathlib import Path

    root = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    roots = [Path(root)] if root and root != "0" else [
        Path.home() / ".cache" / "ms-playwright",
        Path.home() / "Library" / "Caches" / "ms-playwright",
    ]
    return any(next(r.glob("chromium*"), None) is not None for r in roots if r.is_dir())


async def shutdown() -> None:
    async with _lock:
        await _close()
