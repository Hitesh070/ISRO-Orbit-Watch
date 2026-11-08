from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_api_passes_require_norad_and_explicit_site():
    """Pass predictions require an ID plus coordinates and MSL altitude."""
    missing_norad = client.get("/api/passes?lat=13.7&lon=80.2&alt_m=10")
    assert missing_norad.status_code == 422

    missing_site = client.get("/api/passes?city=Bengaluru&norad_id=25544")
    assert missing_site.status_code == 422


def test_api_passes_valid_norad():
    """Providing a valid NORAD ID should return pass predictions for that satellite."""
    response = client.get("/api/passes?lat=13.7&lon=80.2&alt_m=10&norad_id=25544&days=1")
    assert response.status_code == 200
    data = response.json()
    assert data["satellite"]["norad_id"] == 25544
    assert "passes" in data


def test_api_passes_unknown_norad_returns_404():
    """An unknown NORAD ID must return 404 instead of silently falling back."""
    response = client.get("/api/passes?lat=13.7&lon=80.2&alt_m=10&norad_id=99999999")
    assert response.status_code == 404
    assert "99999999" in response.json()["detail"]


def test_api_satellites_limit_bounds():
    """Limit query parameter must enforce 1 <= limit <= 500."""
    # Exceeding upper bound
    res_high = client.get("/api/satellites?limit=999")
    assert res_high.status_code == 422

    # Below lower bound
    res_low = client.get("/api/satellites?limit=0")
    assert res_low.status_code == 422

    # Valid limit
    res_ok = client.get("/api/satellites?limit=10")
    assert res_ok.status_code == 200
    assert len(res_ok.json()["satellites"]) <= 10


def test_api_passes_days_bounds():
    """Days parameter must enforce 1 <= days <= 30."""
    res_high = client.get("/api/passes?days=35")
    assert res_high.status_code == 422

    res_low = client.get("/api/passes?days=0")
    assert res_low.status_code == 422
