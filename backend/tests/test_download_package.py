"""A downloaded source tree includes everything needed to start and inspect it."""

import io
import zipfile

from app.db.download_package import add_run_guide


def test_download_package_adds_local_runtime_and_routes():
    source = io.BytesIO()
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr(
            "main.py", '@app.post("/contacts")\nasync def create_contact():\n    pass\n'
        )
        archive.writestr("models.py", "class Contact: pass\n")

    packaged = add_run_guide(source.getvalue())
    with zipfile.ZipFile(io.BytesIO(packaged)) as archive:
        assert {
            "main.py",
            "models.py",
            "README.md",
            "requirements.txt",
            "Dockerfile",
            "compose.yaml",
            "start.sh",
            ".dockerignore",
            ".env.example",
        } <= set(archive.namelist())
        readme = archive.read("README.md").decode()
        assert "docker compose up --build" in readme
        assert "POST /contacts" in readme
        assert "http://localhost:8000/docs" in readme
        assert "mongod" in archive.read("start.sh").decode()


def test_download_package_preserves_unreadable_legacy_artifact():
    assert add_run_guide(b"zip payload") == b"zip payload"
