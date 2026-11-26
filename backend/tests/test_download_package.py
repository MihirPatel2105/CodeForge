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
        assert "http://localhost:8100/docs" in readme
        assert "mongod" in archive.read("start.sh").decode()


def _package(*, include_admin_ui: bool) -> dict[str, str]:
    source = io.BytesIO()
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("main.py", '@app.get("/contacts")\nasync def list_contacts():\n    pass\n')
    packaged = add_run_guide(source.getvalue(), include_admin_ui=include_admin_ui)
    with zipfile.ZipFile(io.BytesIO(packaged)) as archive:
        return {
            name: archive.read(name).decode()
            for name in archive.namelist()
            if not name.startswith("admin-ui/")
        }


def test_default_ports_do_not_collide_with_codeforge_itself():
    """CodeForge's backend holds 8000 and Langfuse holds 3000 on the same machine, so a
    download started with its defaults could never bind next to a running CodeForge."""
    files = _package(include_admin_ui=True)
    every_file = "\n".join(files.values())

    assert "${API_PORT:-8100}:8000" in files["compose.yaml"]
    assert "${ADMIN_PORT:-3100}:80" in files["compose.admin.yaml"]
    for taken in ("localhost:8000", "localhost:3000", "API_PORT=8000", ":-8000", ":-3000"):
        assert taken not in every_file


def test_api_still_listens_on_8000_inside_its_container():
    files = _package(include_admin_ui=False)

    assert "--port 8000" in files["start.sh"]
    assert "EXPOSE 8000" in files["Dockerfile"]


def test_env_example_names_both_ports_when_the_admin_ui_is_included():
    """`ADMIN_UI_PORT` was written by hand once and silently ignored; naming the real
    variable in the example removes the guess."""
    env_example = _package(include_admin_ui=True)[".env.example"]

    assert "API_PORT=8100" in env_example
    assert "ADMIN_PORT=3100" in env_example


def test_env_example_omits_the_admin_port_without_the_admin_ui():
    env_example = _package(include_admin_ui=False)[".env.example"]

    assert "API_PORT=8100" in env_example
    assert "ADMIN_PORT" not in env_example


def test_admin_guide_points_at_the_default_admin_port():
    guide = _package(include_admin_ui=True)["ADMIN_UI.md"]

    assert "http://localhost:3100" in guide
    assert "http://localhost:8100/docs" in guide


def test_download_package_preserves_unreadable_legacy_artifact():
    assert add_run_guide(b"zip payload") == b"zip payload"
