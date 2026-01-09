import copy
import urllib.parse
import pytest
from fastapi.testclient import TestClient

from src.app import app, activities

# Capture a baseline copy of the in-memory activities
BASELINE = copy.deepcopy(activities)


def reset_activities():
    """Reset the global activities dict to the baseline state."""
    # Remove or reset any mutations done in tests
    # Keep structure consistent with baseline
    for name, details in activities.items():
        base = BASELINE.get(name)
        if base:
            details["description"] = base["description"]
            details["schedule"] = base["schedule"]
            details["max_participants"] = base["max_participants"]
            details["participants"] = list(base["participants"])  # copy
        else:
            # If any extra activities were added in a test, clear participants
            details["participants"] = []


@pytest.fixture
def client():
    reset_activities()
    with TestClient(app) as c:
        yield c
    reset_activities()


def test_root_redirect(client):
    resp = client.get("/", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert resp.headers["location"].endswith("/static/index.html")


def test_get_activities_structure(client):
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert "Soccer Team" in data
    assert isinstance(data["Soccer Team"]["participants"], list)


def test_signup_success(client):
    email = "pytest_user@mergington.edu"
    activity = "Soccer Team"
    path = f"/activities/{urllib.parse.quote(activity)}/signup?email={urllib.parse.quote(email)}"

    resp = client.post(path)
    assert resp.status_code == 200
    assert email in client.get("/activities").json()[activity]["participants"]


def test_signup_duplicate(client):
    # 'alex@mergington.edu' is in baseline participants for Soccer Team
    email = "alex@mergington.edu"
    activity = "Soccer Team"
    path = f"/activities/{urllib.parse.quote(activity)}/signup?email={urllib.parse.quote(email)}"

    resp = client.post(path)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Student already signed up for this activity"


def test_signup_activity_not_found(client):
    resp = client.post("/activities/Unknown/signup?email=any@mergington.edu")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Activity not found"


def test_unregister_success(client):
    # Ensure target participant exists in baseline
    email = "sarah@mergington.edu"
    activity = "Soccer Team"
    path = f"/activities/{urllib.parse.quote(activity)}/unregister?email={urllib.parse.quote(email)}"

    resp = client.delete(path)
    assert resp.status_code == 200
    assert email not in client.get("/activities").json()[activity]["participants"]


def test_unregister_not_found(client):
    email = "notexists@mergington.edu"
    activity = "Soccer Team"
    path = f"/activities/{urllib.parse.quote(activity)}/unregister?email={urllib.parse.quote(email)}"

    resp = client.delete(path)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Student not found in this activity"
