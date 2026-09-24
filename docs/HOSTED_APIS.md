# Hosted generated APIs

This is the opt-in external-use path for a successful run. The platform backend is the
public gateway; the generated FastAPI app and its MongoDB remain inside a Docker
container with `network_mode=none`. No container port is published.

## Owner flow

1. Open a run that passed all sandbox tests and click **Try API**.
2. Click **Publish API**. Save the key shown once and copy the base URL.
3. Append an endpoint path to the base URL. Send `Authorization: Bearer <key>`.
4. Rotate the key if it is lost or exposed. The old key stops working immediately.
5. Click **Unpublish and delete data** to remove the container and named data volume.

For example, if the base URL ends in `/api/v1/deployments/abc` and the generated
app exposes `GET /books`, call `<base URL>/books` with the bearer key. Put the key in
a server-side environment variable. Do not ship it in browser JavaScript.

## Operating limits

- One publication per account; two active publications on one CodeForge host.
- Up to 60 gateway requests per minute per publication.
- JSON request bodies up to 16 KB; response text is shortened to 100,000 characters.
- Each generated request is limited to 20 seconds, 512 MB memory, 1 CPU, and 256 PIDs.
- Hosted data stays on a Docker named volume across container recreation. Unpublishing
  or deleting the owning project/account removes that volume.
- The URL works only while the CodeForge backend and Docker host are online. This is
  self-hosted availability, not a managed cloud uptime promise.

Set `API_PUBLIC_BASE_URL` to the externally reachable **HTTPS backend origin** before
publishing for external users. Its local default is `http://localhost:8000`; a URL
containing localhost is usable only on the same machine. The frontend origin in
`APP_BASE_URL` is a different setting. Put a normal HTTPS reverse proxy in front of
the backend when exposing it to the internet. The Docker socket remains private to
the backend host.

The gateway is intended for server-to-server use. It does not enable wildcard CORS;
browser apps should call their own backend, which keeps the API key secret.
