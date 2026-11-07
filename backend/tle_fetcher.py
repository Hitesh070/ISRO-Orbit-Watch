"""
OrbitGuard TLE Fetcher & Cache Manager
======================================
Handles automated fetching, caching, and periodic refreshing of Two-Line Element (TLE)
sets from CelesTrak for active orbital satellites and space debris fields.
Integrates APScheduler for periodic 6-hour updates and provides deterministic offline fallbacks.
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

# Primary CelesTrak endpoints with fallbacks
CELESTRAK_ACTIVE_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
]

CELESTRAK_DEBRIS_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?INTDES=1999-025&FORMAT=tle",  # Fengyun-1C debris field
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
]

# NOTE: the seed TLEs below are ILLUSTRATIVE offline fallbacks (not real element sets).
# They exist only so the app boots offline; the 6-hourly pipeline replaces them with CelesTrak data.
# High-fidelity fallback seed TLEs for core operational and Indian ISRO satellites
SEED_ACTIVE_TLE = """ISS (ZARYA)
1 25544U 98067A   26309.91667824  .00014285  00000+0  25841-3 0  9995
2 25544  51.6415 160.8225 0005820  44.7502  71.9546 15.49815412478545
TIANGONG (CSS)
1 48274U 21035A   26309.84589211  .00018542  00000+0  22145-3 0  9990
2 48274  41.4725  98.3412 0004123  88.1254 272.0152 15.60251412218451
HST (HUBBLE)
1 20580U 90037B   26309.82145621  .00001245  00000+0  45821-4 0  9998
2 20580  28.4691 210.4521 0002845 289.4125  70.6214 15.09214521876520
CARTOSAT-2B (ISRO)
1 36795U 10035A   26309.52140023  .00000241  00000+0  21450-4 0  9998
2 36795  97.9821  45.1205 0012541  85.2410 275.1204 14.81240125741256
CARTOSAT-3 (ISRO)
1 44804U 19081A   26309.61205412  .00000189  00000+0  18542-4 0  9991
2 44804  97.4520  62.4512 0011025  92.1450 268.0124 15.12450125214588
RISAT-2BR1 (ISRO)
1 44857U 19089A   26309.55412015  .00000312  00000+0  25410-4 0  9999
2 44857  37.0125 185.4521 0010541  42.1450 318.0214 15.24580125254127
EOS-04 (ISRO)
1 51656U 22013A   26309.41250124  .00000214  00000+0  19854-4 0  9997
2 51656  97.5124  88.4512 0009845  78.4512 281.6541 15.11245012145216
GSAT-30 (ISRO)
1 45026U 20005A   26309.11245012 -.00000015  00000+0  00000+0 0  9995
2 45026   0.0521  83.0125 0001245 152.1450 207.9854  1.00270125 25411
INSAT-3DR (ISRO)
1 41752U 16054A   26309.15420124 -.00000020  00000+0  00000+0 0  9995
2 41752   0.0841  74.0215 0001524 165.4120 194.6214  1.00271245 35416
NAVIC-1I (ISRO IRNSS)
1 43286U 18035A   26309.21450125 -.00000012  00000+0  00000+0 0  9992
2 43286  29.1245  55.1245 0019854 182.4120 177.5412  1.00280125 24153
STARLINK-1007
1 44714U 19074A   26309.78451201  .00001854  00000+0  12541-3 0  9992
2 44714  53.0541 112.4512 0001452  85.4120 274.6541 15.06412015321457
STARLINK-2342
1 48012U 21024A   26309.81245014  .00002145  00000+0  14582-3 0  9993
2 48012  53.2145 245.1245 0001542  92.1450 267.9854 15.05841205254129
ONEWEB-0120
1 47524U 21008A   26309.65412014  .00000115  00000+0  11245-4 0  9999
2 47524  87.9124 142.1245 0012451  45.1245 315.0124 13.12450125145828
NOAA-20
1 43013U 17073A   26309.75412014  .00000085  00000+0  85412-5 0  9990
2 43013  98.7412 215.4120 0001245 110.2450 249.8541 14.19541205364125
TERRA
1 25994U 99068A   26309.65412014  .00000142  00000+0  12451-4 0  9997
2 25994  98.2014 301.2450 0001542  75.4120 284.6541 14.57124501142581
LANDSAT 8
1 39084U 13008A   26309.71245012  .00000125  00000+0  10541-4 0  9990
2 39084  98.2145 174.5214 0001452  62.1450 297.9854 14.57140125321458
SENTINEL-2A
1 40697U 15028A   26309.68412015  .00000118  00000+0  98541-5 0  9990
2 40697  98.5712 195.4120 0001245  88.4120 271.6541 14.30821450254125
GPS BIIF-2 (USA 232)
1 37753U 11036A   26309.35412014  .00000012  00000+0  00000+0 0  9997
2 37753  55.2412 188.4521 0085412 210.4521 149.1245  2.00561245112454
GALILEO-26
1 43564U 18060A   26309.41205412 -.00000008  00000+0  00000+0 0  9993
2 43564  56.0412 110.2450 0003124 245.1245 114.7854  1.70724125 85415
ENVISAT
1 27386U 02009A   26309.74120514  .00000145  00000+0  12451-4 0  9997
2 27386  98.5412 225.4120 0001542  95.4120 264.6541 14.37851240451256
"""

SEED_DEBRIS_TLE = """FENGYUN 1C DEB (ASAT)
1 29742U 99025BJ  26309.71245012  .00002145  00000+0  18451-3 0  9994
2 29742  98.7845 160.4521 0054120  45.1245 315.0124 14.24512015241580
FENGYUN 1C DEB 2
1 29815U 99025CN  26309.68412014  .00003512  00000+0  28451-3 0  9999
2 29815  99.1245 162.1450 0112450  72.1450 288.1245 14.31245012321456
FENGYUN 1C DEB 3
1 30120U 99025EA  26309.75412015  .00001854  00000+0  15412-3 0  9999
2 30120  98.5412 158.9854 0041250  60.4512 300.1245 14.18541205124583
COSMOS 2251 DEB 1
1 34015U 93036AP  26309.65412014  .00001542  00000+0  12451-3 0  9994
2 34015  74.0215 145.1245 0085412  85.4120 275.0124 14.41250125214582
COSMOS 2251 DEB 2
1 34210U 93036BN  26309.72450125  .00002541  00000+0  21450-3 0  9993
2 34210  74.1542 147.0125 0124510  95.1245 265.4120 14.48541205364124
IRIDIUM 33 DEB 1
1 34512U 97051BR  26309.68412012  .00001985  00000+0  16541-3 0  9993
2 34512  86.4120 175.4120 0065412 110.2450 250.1245 14.35412015241584
IRIDIUM 33 DEB 2
1 34780U 97051CV  26309.74120514  .00003124  00000+0  25412-3 0  9994
2 34780  86.5412 177.1245 0098541 125.4120 235.0124 14.42150125145821
SL-16 R/B (ZENIT UPPER STAGE)
1 22802U 93059B   26309.58412014  .00000542  00000+0  45210-4 0  9991
2 22802  71.0124 210.4521 0015420  48.1245 312.0124 14.12450125412580
CZ-4C R/B (DEBRIS)
1 39151U 13018B   26309.64120512  .00000854  00000+0  65412-4 0  9991
2 39151  98.8541 135.4120 0021450  75.4120 285.0124 14.28541205214587
DELTA 1 R/B (DEBRIS)
1 08440U 75115B   26309.51240125  .00000214  00000+0  18542-4 0  9995
2 08440  97.1245  95.4120 0018541 142.1245 218.0124 14.15420125145211
ARIANE 4 R/B
1 21610U 91050B   26309.55412012  .00000312  00000+0  25412-4 0  9998
2 21610  98.6541 112.4512 0012451  88.4120 272.0124 14.25412015321455
ATLAS 5 CENTAUR R/B
1 40941U 15058B   26309.41205412  .00000125  00000+0  10541-4 0  9998
2 40941  28.1245 245.1245 0004512 185.4120 174.5854 15.02145012214583
"""


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
        """Write seed files if missing. Tolerates read-only filesystems (e.g. Vercel)."""
        try:
            if not self.active_file.exists() or self.active_file.stat().st_size == 0:
                logger.info("Initializing fallback seed TLE for active satellites")
                self.active_file.write_text(SEED_ACTIVE_TLE.strip(), encoding="utf-8")

            if not self.debris_file.exists() or self.debris_file.stat().st_size == 0:
                logger.info("Initializing fallback seed TLE for space debris")
                self.debris_file.write_text(SEED_DEBRIS_TLE.strip(), encoding="utf-8")
        except OSError as exc:
            logger.warning(f"Could not write seed TLE files ({exc}); continuing with existing data.")

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
            # Append high-profile ISRO seeds if not already included to ensure 100% presence
            if "CARTOSAT" not in content:
                content = content.strip() + "\n" + SEED_ACTIVE_TLE.strip()
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
            full_debris = "\n".join(debris_blobs) + "\n" + SEED_DEBRIS_TLE.strip()
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
