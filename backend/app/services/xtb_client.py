"""
Minimal XTB xAPI client over WebSockets.

XTB's API is documented at: http://developers.xstore.pro/documentation/
Auth flow: connect to the WS endpoint, send a "login" command with your
user ID + password, then send further commands (e.g. getTrades,
getMarginLevel) using the returned streamSessionId where needed.

This is a thin async wrapper for the two calls the MVP needs:
  - login
  - getTrades (open positions)

NOTE: XTB's demo and real endpoints are different URLs - see config.py.
Real accounts require using the real WS endpoint (wss://ws.xtb.com/real).
"""

import json

import websockets


class XTBClient:
    def __init__(self, ws_url: str, user_id: str, password: str):
        self.ws_url = ws_url
        self.user_id = user_id
        self.password = password
        self._ws = None

    async def connect(self):
        self._ws = await websockets.connect(self.ws_url)
        await self._send(
            {
                "command": "login",
                "arguments": {"userId": self.user_id, "password": self.password},
            }
        )
        response = await self._recv()
        if not response.get("status"):
            raise ConnectionError(f"XTB login failed: {response}")
        return response

    async def get_open_positions(self) -> list[dict]:
        """Returns raw open trade records from XTB. Map these to Position rows
        in the calling code (ticker/symbol names differ from T212's)."""
        await self._send(
            {
                "command": "getTrades",
                "arguments": {"openedOnly": True},
            }
        )
        response = await self._recv()
        if not response.get("status"):
            raise RuntimeError(f"XTB getTrades failed: {response}")
        return response.get("returnData", [])

    async def close(self):
        if self._ws:
            await self._ws.close()

    async def _send(self, payload: dict):
        await self._ws.send(json.dumps(payload))

    async def _recv(self) -> dict:
        raw = await self._ws.recv()
        return json.loads(raw)


async def fetch_xtb_positions(ws_url: str, user_id: str, password: str) -> list[dict]:
    """Convenience one-shot helper: login, fetch positions, disconnect."""
    client = XTBClient(ws_url, user_id, password)
    try:
        await client.connect()
        return await client.get_open_positions()
    finally:
        await client.close()
