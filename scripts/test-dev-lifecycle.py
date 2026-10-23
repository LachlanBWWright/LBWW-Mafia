#!/usr/bin/env python3
"""Exercise launcher process groups and signal cleanup without stopping real services."""
import os
import json
import fcntl
from pathlib import Path
import pty
import shutil
import signal
import socket
import subprocess
import tempfile
import termios
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]

DOCKER = '''#!/usr/bin/env python3
import os, pathlib, sys
state = pathlib.Path(os.environ["LAUNCHER_TEST_STATE"])
if "up" in sys.argv:
    (state / "database-started").touch()
    sys.exit(7 if os.environ.get("FAIL_START") else 0)
if "stop" in sys.argv:
    (state / "database-stopped").touch()
    sys.exit(0)
raise SystemExit("Unexpected Docker command")
'''
PNPM = '''#!/usr/bin/env python3
import os, pathlib, signal, subprocess, sys, time
state = pathlib.Path(os.environ["LAUNCHER_TEST_STATE"])
if "start:partyserver" in sys.argv:
    import json
    (state / "worker-args").write_text(json.dumps(sys.argv[1:]))
    sys.exit(0)
if "db:migrate" in sys.argv:
    (state / "migrated").touch()
    assert os.environ["DATABASE_URL_UNPOOLED"] == os.environ["DATABASE_URL"]
    assert os.environ["DIRECT_MESSAGES_DATABASE_URL"] == os.environ["DATABASE_URL"]
    sys.exit(8 if os.environ.get("FAIL_MIGRATION") else 0)
assert "concurrently" in sys.argv
assert "bash scripts/partyserver-dev.sh" in sys.argv
assert (state / "migrated").exists()
children = [subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"], process_group=0) for _ in range(2)]
(state / "children").write_text(" ".join(str(child.pid) for child in children))
def stop(*args):
    for child in children:
        child.terminate()
    for child in children:
        child.wait()
    sys.exit(0)
signal.signal(signal.SIGTERM, stop)
(state / "ready").touch()
if os.environ.get("FAIL_RUNTIME"):
    # Leave descendants alive: the launcher's group cleanup must reach them.
    sys.exit(9)
while True:
    time.sleep(1)
'''


PLAYWRIGHT_PNPM = '''#!/usr/bin/env python3
import os, pathlib, signal, subprocess, sys, time
state = pathlib.Path(os.environ["LAUNCHER_TEST_STATE"])
if "wait-on" in sys.argv:
    sys.exit(0)
name = "next" if "next" in sys.argv else "worker"
# pnpm 11 creates nested groups, and services can ignore TERM during shutdown.
child = subprocess.Popen([sys.executable, "-c", "import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(120)"], process_group=0)
with (state / "children").open("a") as output:
    output.write(str(child.pid) + " ")
(state / (name + "-ready")).touch()
while True:
    time.sleep(1)
'''


def unused_port():
    with socket.socket() as connection:
        connection.bind(("127.0.0.1", 0))
        return str(connection.getsockname()[1])


def alive(pid):
    try:
        return Path(f"/proc/{pid}/stat").read_text().split(") ")[1][0] != "Z"
    except FileNotFoundError:
        return False


class LauncherLifecycle(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="mafia-launcher-test-")
        self.directory = Path(self.temp.name)
        (self.directory / "scripts").mkdir()
        for name in ("dev-local.sh", "partyserver-dev.sh", "_common.sh"):
            shutil.copy(ROOT / "scripts" / name, self.directory / "scripts" / name)
        binary = self.directory / "bin"
        binary.mkdir()
        for name, content in (("docker", DOCKER), ("pnpm", PNPM)):
            path = binary / name
            path.write_text(content)
            path.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": f"{binary}:{os.environ['PATH']}",
            "LAUNCHER_TEST_STATE": str(self.directory),
            "WEB_PORT": unused_port(),
            "PARTYSERVER_PORT": unused_port(),
            "MAFIA_AI_BOT_PORT": unused_port(),
        }
        self.process = None

    def tearDown(self):
        if self.process and self.process.poll() is None:
            self.process.send_signal(signal.SIGTERM)
            self.process.communicate(timeout=15)
        children = self.directory / "children"
        if children.exists():
            for pid in map(int, children.read_text().split()):
                if alive(pid):
                    os.kill(pid, signal.SIGKILL)
        self.temp.cleanup()

    def launch(self, **extra):
        self.process = subprocess.Popen(
            ["bash", str(self.directory / "scripts/dev-local.sh")],
            env={**self.env, **extra},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )

    def wait_for_runtime(self):
        for _ in range(100):
            if (self.directory / "ready").exists():
                return
            if self.process.poll() is not None:
                self.fail(self.process.communicate()[0])
            time.sleep(0.05)
        self.fail("Runtime did not start")

    def assert_stopped(self, expected):
        output, _ = self.process.communicate(timeout=15)
        self.assertEqual(self.process.returncode, expected, output)
        self.assertTrue((self.directory / "database-stopped").exists(), output)
        children = self.directory / "children"
        if children.exists():
            for pid in map(int, children.read_text().split()):
                self.assertFalse(alive(pid), f"Orphaned service process {pid}")

    def test_worker_bindings_are_forwarded_without_shell_interpretation(self):
        secret = "local secret:with=punctuation;$(touch should-not-exist)"
        result = subprocess.run(
            ["bash", str(self.directory / "scripts/partyserver-dev.sh")],
            env={**self.env, "BACKEND_SECRET": secret, "DEBUG": "true", "DAY_SECONDS": "10"},
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads((self.directory / "worker-args").read_text())
        self.assertEqual(args[:4], ["--dir", "server", "run", "start:partyserver"])
        self.assertIn(f"BACKEND_SECRET:{secret}", args)
        self.assertIn("DEBUG:true", args)
        self.assertIn("DAY_SECONDS:10", args)
        self.assertNotIn("NEXTJS_URL:", args)
        self.assertEqual(args[args.index("--port") + 1], self.env["PARTYSERVER_PORT"])
        self.assertFalse((self.directory / "should-not-exist").exists())

    def test_playwright_termination_stops_nested_service_groups_and_closes_pipes(self):
        shutil.copy(ROOT / "scripts/playwright-server.sh", self.directory / "scripts/playwright-server.sh")
        (self.directory / "bin/pnpm").write_text(PLAYWRIGHT_PNPM)
        self.process = subprocess.Popen(
            ["bash", str(self.directory / "scripts/playwright-server.sh")],
            env={**self.env, "PLAYWRIGHT_NO_DB": "true"},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        for _ in range(100):
            if all((self.directory / (name + "-ready")).exists() for name in ("next", "worker")):
                break
            if self.process.poll() is not None:
                self.fail(self.process.communicate()[0])
            time.sleep(0.05)
        else:
            self.fail("Playwright services did not start")
        self.process.send_signal(signal.SIGTERM)
        output, _ = self.process.communicate(timeout=15)
        self.assertEqual(self.process.returncode, 143, output)
        for pid in map(int, (self.directory / "children").read_text().split()):
            self.assertFalse(alive(pid), f"Orphaned nested service process {pid}")

    def test_terminal_close(self):
        self.launch()
        self.wait_for_runtime()
        self.process.send_signal(signal.SIGHUP)
        self.assert_stopped(129)

    def test_closing_a_real_terminal(self):
        master, slave = pty.openpty()

        def attach_terminal():
            os.setsid()
            fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

        try:
            self.process = subprocess.Popen(
                ["bash", str(self.directory / "scripts/dev-local.sh")],
                env=self.env,
                stdin=slave,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                preexec_fn=attach_terminal,
            )
            os.close(slave)
            slave = None
            self.wait_for_runtime()
            os.close(master)
            master = None
            self.assert_stopped(129)
        finally:
            for descriptor in (master, slave):
                if descriptor is not None:
                    os.close(descriptor)

    def test_ctrl_c(self):
        self.launch()
        self.wait_for_runtime()
        self.process.send_signal(signal.SIGINT)
        self.assert_stopped(130)

    def test_terminal_termination(self):
        self.launch()
        self.wait_for_runtime()
        self.process.send_signal(signal.SIGTERM)
        self.assert_stopped(143)

    def test_database_startup_failure(self):
        self.launch(FAIL_START="1")
        self.assert_stopped(7)
        self.assertFalse((self.directory / "migrated").exists())

    def test_occupied_port_does_not_start_or_stop_the_database(self):
        with socket.socket() as connection:
            connection.bind(("127.0.0.1", 0))
            connection.listen()
            self.launch(WEB_PORT=str(connection.getsockname()[1]))
            output, _ = self.process.communicate(timeout=10)
            self.assertNotEqual(self.process.returncode, 0)
            self.assertIn("port", output)
            self.assertFalse((self.directory / "database-started").exists())
            self.assertFalse((self.directory / "database-stopped").exists())

    def test_migration_failure(self):
        self.launch(FAIL_MIGRATION="1")
        self.assert_stopped(8)
        self.assertFalse((self.directory / "ready").exists())

    def test_runtime_failure_cleans_descendants(self):
        self.launch(FAIL_RUNTIME="1")
        self.assert_stopped(9)


if __name__ == "__main__":
    unittest.main()
