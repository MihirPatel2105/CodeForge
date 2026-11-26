"""Optional UI packaging preserves the generated API and its stored evidence."""

import io
import zipfile

from app.db.download_package import add_run_guide


def source_zip(extra=None):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("main.py", '@app.get("/books")\nasync def books(): return []\n')
        archive.writestr("models.py", "# original models\n")
        for name, content in (extra or {}).items():
            archive.writestr(name, content)
    return output.getvalue()


def test_api_only_remains_default():
    with zipfile.ZipFile(io.BytesIO(add_run_guide(source_zip()))) as archive:
        assert "compose.yaml" in archive.namelist()
        assert "compose.admin.yaml" not in archive.namelist()
        assert not any(name.startswith("admin-ui/") for name in archive.namelist())


def test_admin_option_is_runnable_and_preserves_api_source():
    source = source_zip()
    packaged = add_run_guide(source, include_admin_ui=True)
    with zipfile.ZipFile(io.BytesIO(packaged)) as archive:
        assert archive.read("models.py") == b"# original models\n"
        assert "admin-ui/app/page.jsx" in archive.namelist()
        assert "admin-ui/lib/schema.mjs" in archive.namelist()
        assert "admin-ui/node_modules" not in archive.namelist()
        compose = archive.read("compose.admin.yaml").decode()
        assert "127.0.0.1:${ADMIN_PORT:-3100}:80" in compose
        assert "build: ./admin-ui" in compose
        assert "proxy_pass http://api:8000/;" in archive.read("admin-ui/nginx.conf").decode()
        assert "-f compose.admin.yaml up --build" in archive.read("ADMIN_UI.md").decode()
        assert "next build" in archive.read("admin-ui/package.json").decode()
    with zipfile.ZipFile(io.BytesIO(source)) as original:
        assert original.namelist() == ["main.py", "models.py"]


def test_optional_package_never_overwrites_existing_files():
    original = source_zip({"README.md": "custom", "admin-ui/app/page.jsx": "custom page"})
    with zipfile.ZipFile(io.BytesIO(add_run_guide(original, include_admin_ui=True))) as archive:
        assert archive.read("README.md") == b"custom"
        assert archive.read("admin-ui/app/page.jsx") == b"custom page"
        assert len(archive.namelist()) == len(set(archive.namelist()))


def test_non_application_and_invalid_archives_are_unchanged():
    assert add_run_guide(b"not a zip", include_admin_ui=True) == b"not a zip"
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("test_report.json", "{}")
    source = output.getvalue()
    assert add_run_guide(source, include_admin_ui=True) == source
