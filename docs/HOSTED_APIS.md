# Hosted generated APIs

This is the opt-in external-use path for a successful run. The platform backend is the
public gateway; the generated FastAPI app and its MongoDB remain inside a Docker
container with `network_mode=none`. No container port is published.

## Owner flow

1. Open a run that passed all sandbox tests and click **Use your API**.
2. Choose **Publish API**. Copy the one-time key and the base URL; reveal the key only if needed.
3. Follow the on-page guide: select an endpoint, copy its cURL, Node.js, or Python example,
   and send `Authorization: Bearer <key>` from a server or terminal.
   Use **Check connection** to probe the hosted application and see its response time and
   current-minute request usage. This checks the private runtime; it does not prove that
   the configured backend URL is reachable from another device.
4. Rotate the key if it is lost or exposed. The old key stops working immediately.
5. Click **Unpublish and delete data** to remove the container and named data volume.

For example, if the base URL ends in `/api/v1/deployments/abc` and the generated
app exposes `GET /books`, call `<base URL>/books` with the bearer key. Put the key in
a server-side environment variable. Do not ship it in browser JavaScript.

## Operating limits

- One publication per account; two active publications on one CodeForge host.
- Up to 60 gateway requests per minute per publication.
- JSON request bodies up to 16 KB. Responses over 100,000 characters return an explicit
  `502 published_response_too_large` error instead of incomplete data. Invalid JSON
  returns `502 published_response_invalid`; generated server errors use safe gateway copy.
- Successful gateway responses and rate-limit errors include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
  `X-RateLimit-Reset`. Rate-limit responses also include `Retry-After` in seconds.
  Owner connection checks share the publication's allowance.
- Each generated request is limited to 20 seconds, 512 MB memory, 1 CPU, and 256 PIDs.
  Queue waits are bounded to two seconds; container recovery/startup is a separate step.
  Requests still run in separate application processes, so this is intended for modest
  CRUD traffic. Publication activates only after the application serves valid OpenAPI.
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

Users who want to run or change the generated source can download its runnable zip.
It includes a README, a pinned Python dependency list, Dockerfile, Compose setup, and
the generated tests. This is separate from the hosted publication and needs no API key.
