# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue. Use GitHub's
**"Report a vulnerability"** button under the repository's *Security* tab (Private
vulnerability reporting), or email the maintainers at Volare Consulting. We'll acknowledge
the report and work with you on a fix and disclosure timeline.

## Threat model

`gimp-mcp` is a local MCP server. It launches `gimp-console` and talks to GIMP's built-in
Script-Fu TCP server bound to **loopback only** (`127.0.0.1`). It runs with the privileges
of the user who started it.

Two things are worth understanding before you expose it to a client:

- **`run_script_fu` evaluates arbitrary Script-Fu (Scheme).** Script-Fu can read and write
  files anywhere the invoking user can, and can call plug-ins. Any MCP client that can reach
  this server can therefore run code with the user's filesystem access. Treat model output
  that flows into `run_script_fu` as untrusted code, not data.
- **File paths are not sandboxed.** `open_image` / `export_image` and friends operate on
  whatever paths the client supplies, within the user's permissions.

### Recommendations

- Only connect MCP clients you trust.
- Run the server as a least-privileged user when editing untrusted images.
- The Script-Fu server listens on loopback; do not forward or expose `GIMP_MCP_PORT`.

## Supported versions

Fixes are applied to the latest published version on npm.
