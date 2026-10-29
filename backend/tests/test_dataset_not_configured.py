import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.db import DuckDBManager
from app.main import app


class DatasetNotConfiguredTests(unittest.TestCase):
    def setUp(self):
        self.previous_connection = DuckDBManager._instance
        DuckDBManager._instance = None
        self.data_path = patch(
            "app.core.db.DATA_PATH", Path("missing-test-dataset.csv")
        )
        self.data_path.start()
        self.addCleanup(self.data_path.stop)
        self.addCleanup(self.restore_connection)
        self.client = TestClient(app)

    def restore_connection(self):
        DuckDBManager._instance = self.previous_connection

    def test_platform_health_is_independent_of_dataset(self):
        response = self.client.get("/healthz")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_api_reports_missing_dataset_without_crashing(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["dataset_status"], "missing")

    def test_analytics_returns_actionable_unavailable_response(self):
        response = self.client.get("/api/metrics/summary")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["dataset_status"], "missing")

    def test_account_features_require_persistent_database_configuration(self):
        response = self.client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "LongEnoughPassword1"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("DATABASE_URL", response.json()["detail"])
