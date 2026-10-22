import sys
import os
import unittest
import subprocess
import time
import json
import asyncio
import websockets

class TestVisionAgentServer(unittest.TestCase):
    def test_websocket_handshake_and_events(self):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        port = 8799

        # Launch agent server in simulated test mode
        cmd = [sys.executable, os.path.join(root_dir, "vision", "agent_server.py"), "--port", str(port), "--test"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        try:
            time.sleep(1.2)  # Give server time to bind

            async def client_session():
                uri = f"ws://localhost:{port}"
                async with websockets.connect(uri) as ws:
                    # 1. First message should be handshake confirmation
                    handshake_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    handshake = json.loads(handshake_raw)
                    self.assertEqual(handshake.get("type"), "agentStatus")
                    self.assertEqual(handshake.get("status"), "ready")
                    self.assertEqual(handshake.get("canvas", {}).get("width"), 1000.0)
                    self.assertEqual(handshake.get("canvas", {}).get("height"), 700.0)

                    # 2. Next messages should be normalized canvas input events
                    event_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    event = json.loads(event_raw)
                    self.assertIn(event.get("type"), ["cursorMoved", "penDown", "penUp", "strokeFinished"])
                    if "x" in event:
                        self.assertGreaterEqual(event["x"], 0.0)
                        self.assertLessEqual(event["x"], 1000.0)
                    if "y" in event:
                        self.assertGreaterEqual(event["y"], 0.0)
                        self.assertLessEqual(event["y"], 700.0)

            asyncio.run(client_session())

        finally:
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()
            proc.terminate()
            try:
                proc.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                proc.kill()

if __name__ == "__main__":
    unittest.main()
