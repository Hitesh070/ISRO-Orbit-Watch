"""
OrbitGuard TLE Fetcher & Cache Manager
======================================
Handles automated fetching, caching, and periodic refreshing of Two-Line Element (TLE)
sets from CelesTrak for active orbital satellites and space debris fields.
Integrates APScheduler for periodic catalog refreshes and leaves data unavailable when no verified source exists.
"""

import logging
from pathlib import Path
from typing import Optional

import httpx

try:  # optional: only needed for local/Docker deployments, not for the GitHub Actions pipeline
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # pragma: no cover
    BackgroundScheduler = None  # type: ignore[assignment,misc]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("orbitguard.tle_fetcher")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ACTIVE_SATS_FILE = DATA_DIR / "active_sats.tle"
DEBRIS_FILE = DATA_DIR / "debris.tle"

# CelesTrak orbital element endpoints
CELESTRAK_ACTIVE_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
]

CELESTRAK_DEBRIS_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?INTDES=1999-025&FORMAT=tle",  # Fengyun-1C debris field
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
]




class TLEFetcher:
    """
    Manages TLE retrieval from CelesTrak, caching to disk, and scheduled background updates.
    """

    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            logger.warning(f"Could not create data dir ({exc}).")
        self.active_file = self.data_dir / "active_sats.tle"
        self.debris_file = self.data_dir / "debris.tle"
        self.scheduler = None
        self._ensure_seed_files()

    def _ensure_seed_files(self) -> None:
        """Leave missing catalogs empty; illustrative element sets are not operational data."""
        for file_path, label in ((self.active_file, "active catalog"), (self.debris_file, "debris catalog")):
            if not file_path.exists() or file_path.stat().st_size == 0:
                logger.warning("No verified %s is available at %s", label, file_path)

    def fetch_url(self, urls: list[str], timeout: float = 12.0) -> Optional[str]:
        """Attempt downloading TLE text from a list of candidate URLs."""
        for url in urls:
            try:
                logger.info(f"Attempting to fetch TLE from: {url}")
                with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                    resp = client.get(url)
                    if resp.status_code == 200 and ("1 " in resp.text and "2 " in resp.text):
                        logger.info(f"Successfully fetched {len(resp.text)} bytes from {url}")
                        return resp.text
                    else:
                        logger.warning(f"URL {url} returned status {resp.status_code} or invalid TLE")
            except Exception as exc:
                logger.warning(f"Fetch failed for {url}: {exc}")
        return None

    def refresh_active_satellites(self) -> bool:
        """Fetch latest active satellites and cache them."""
        content = self.fetch_url(CELESTRAK_ACTIVE_URLS)
        if content:
            self.active_file.write_text(content.strip(), encoding="utf-8")
            logger.info(f"Updated active satellites cache: {self.active_file}")
            return True
        logger.warning("Could not refresh active satellites from network; retaining existing cache.")
        return False

    def refresh_debris(self) -> bool:
        """Fetch latest debris catalogue and cache them."""
        # We can aggregate Fengyun-1C, Cosmos-2251 and Iridium-33 debris fields
        debris_blobs = []
        for url in CELESTRAK_DEBRIS_URLS:
            blob = self.fetch_url([url])
            if blob and "1 " in blob:
                debris_blobs.append(blob.strip())

        if debris_blobs:
            full_debris = "\n".join(debris_blobs)
            self.debris_file.write_text(full_debris.strip(), encoding="utf-8")
            logger.info(f"Updated debris cache: {self.debris_file} with {len(debris_blobs)} sources")
            return True

        logger.warning("Could not refresh debris from network; retaining existing cache.")
        return False

    def refresh_all(self) -> None:
        """Refresh both active and debris catalogs."""
        logger.info("Executing periodic TLE refresh cycle...")
        self.refresh_active_satellites()
        self.refresh_debris()

    def start_scheduler(self, interval_hours: int = 6) -> None:
        """Start the background APScheduler to run refresh every `interval_hours`."""
        if BackgroundScheduler is None:
            logger.warning("apscheduler not installed; periodic refresh disabled.")
            return
        if self.scheduler is None:
            self.scheduler = BackgroundScheduler(daemon=True)
            self.scheduler.add_job(
                self.refresh_all,
                "interval",
                hours=interval_hours,
                id="tle_periodic_refresh",
                replace_existing=True,
            )
            self.scheduler.start()
            logger.info(f"APScheduler started: TLE data refresh scheduled every {interval_hours} hours.")

    def stop_scheduler(self) -> None:
        """Gracefully shutdown scheduler."""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("APScheduler stopped.")


# Module singleton
tle_fetcher = TLEFetcher()
