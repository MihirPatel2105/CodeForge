"""Exercise the local launcher without starting or stopping real services."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class StartScriptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copy(ROOT / "start.sh", self.root / "start.sh")
        (self.root / "backend").mkdir()
        (self.root / "backend/.env").touch()
        (self.root / "frontend/node_modules").mkdir(parents=True)
        (self.root / "sandbox").mkdir()
        (self.root / "sandbox/Dockerfile").write_text("FROM scratch\n")
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.log = self.root / "commands.log"
        self.mock(
            "docker",
            """
printf 'docker %s\\n' "$*" >> "$COMMAND_LOG"
case "$*" in
  info) exit 0 ;;
  *"sandbox-docker docker build"*)
    exit 99 ;;
  "build "*) exit "${BUILD_FAIL:-0}" ;;
  "image save "*) printf 'image archive'; exit 0 ;;
  *"sandbox-docker docker image load"*)
    cat >/dev/null
    exit "${LOAD_FAIL:-0}" ;;
  *"backend python -c"*) exit "${CONNECTION_FAIL:-0}" ;;
  *"sandbox-docker docker image inspect"*) exit "${IMAGE_MISSING:-0}" ;;
  "image inspect"*) exit 99 ;;
esac
""",
        )
        self.mock("npm", 'printf "npm %s\\n" "$*" >> "$COMMAND_LOG"')
        self.mock("curl", "exit 0")
        self.mock("lsof", "exit 1")

    def mock(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/bash\n" + body + "\n")
        path.chmod(0o755)

    def run_script(self, *args, **flags):
        return subprocess.run(
            ["bash", str(self.root / "start.sh"), *args],
            cwd=self.root,
            env={
                **os.environ,
                "PATH": f"{self.bin}:{os.environ['PATH']}",
                "COMMAND_LOG": str(self.log),
                **flags,
            },
            text=True,
            capture_output=True,
            timeout=10,
        )

    def test_start_builds_on_host_and_loads_isolated_daemon_before_backend_check(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        docker_commands = [line for line in commands if line.startswith("docker compose")]
        self.assertTrue(docker_commands)
        self.assertTrue(all("compose.local-sandbox.yml" in line for line in docker_commands))
        build = next(i for i, line in enumerate(commands) if line.startswith("docker build "))
        save = next(i for i, line in enumerate(commands) if "docker image save" in line)
        load = next(
            i for i, line in enumerate(commands) if "sandbox-docker docker image load" in line
        )
        connect = next(i for i, line in enumerate(commands) if "backend python -c" in line)
        frontend = next(i for i, line in enumerate(commands) if "npm run dev" in line)
        self.assertLess(build, save)
        self.assertLess(build, load)
        self.assertLess(save, connect)
        self.assertLess(load, connect)
        self.assertFalse(any("sandbox-docker docker build" in line for line in commands))
        self.assertLess(connect, frontend)

    def test_failed_image_transfer_does_not_start_backend_or_frontend(self):
        result = self.run_script(LOAD_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        commands = self.log.read_text()
        self.assertNotIn("up -d --build", commands)
        self.assertNotIn("npm run dev", commands)
        self.assertIn(" stop", commands)

    def test_failed_image_build_does_not_start_frontend(self):
        result = self.run_script(BUILD_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        commands = self.log.read_text()
        self.assertNotIn("npm run dev", commands)
        self.assertNotIn("up -d --build", commands)
        self.assertIn(" stop", commands)

    def test_failed_backend_connection_does_not_report_ready(self):
        result = self.run_script(CONNECTION_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Backend cannot reach its sandbox image", result.stderr)
        self.assertNotIn("4/4  Ready", result.stdout)
        self.assertNotIn("npm run dev", self.log.read_text())

    def test_check_is_read_only_and_uses_nested_image(self):
        result = self.run_script("--check", IMAGE_MISSING="1")
        self.assertNotEqual(result.returncode, 0)
        commands = self.log.read_text()
        self.assertIn("sandbox-docker docker image inspect", commands)
        self.assertNotIn(" up ", commands)
        self.assertNotIn("docker build", commands)
        self.assertNotIn(" stop", commands)

    def test_stop_includes_local_sandbox(self):
        result = self.run_script("--stop")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("compose.local-sandbox.yml stop", self.log.read_text())


if __name__ == "__main__":
    unittest.main()
