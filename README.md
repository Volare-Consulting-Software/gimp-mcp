# gimp-mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants (Claude
Desktop, Claude Code, and any other MCP client) edit images with
[GIMP](https://www.gimp.org).

Unlike most GIMP MCP servers, `gimp-mcp`:

- is a plain **npm package** — run it with `npx gimp-mcp`, no Python environment;
- needs **no custom GIMP plug-in** and **no running GIMP window** — it drives GIMP's
  built-in headless console (`gimp-console`) in batch mode, one operation at a time;
- works on **Windows, macOS, and Linux**, and points you to the right installer if GIMP
  isn't present (`gimp_doctor` / `install_gimp`).

Each tool loads an image from disk, performs an operation, and writes the result back
to disk. It is stateless and file-in / file-out by design.

## Requirements

- **Node.js ≥ 18**
- **GIMP 2.10 or 3.x** installed (verified against GIMP 3.2). See
  [Installing GIMP](#installing-gimp).

## Quick start

Add the server to your MCP client. For **Claude Desktop**, edit
`claude_desktop_config.json` (a full example is in
[`examples/claude_desktop_config.json`](examples/claude_desktop_config.json)):

```json
{
  "mcpServers": {
    "gimp": {
      "command": "npx",
      "args": ["-y", "gimp-mcp"]
    }
  }
}
```

For **Claude Code**:

```bash
claude mcp add gimp -- npx -y gimp-mcp
```

Then ask your assistant to "check the GIMP setup" — it will call `gimp_doctor`. If GIMP
is missing it will tell you exactly how to install it.

## Installing GIMP

The recommended, all-platform option is the official installer:

> **Download GIMP: https://www.gimp.org/downloads/**

Or use a package manager:

| OS      | Command                                       |
| ------- | --------------------------------------------- |
| Windows | `winget install --id GIMP.GIMP -e`            |
| macOS   | `brew install --cask gimp`                    |
| Linux   | `flatpak install -y flathub org.gimp.GIMP` (or `sudo apt install gimp`) |

The `gimp_doctor` and `install_gimp` tools report this guidance for the OS you're on.
For safety, the server **never runs an installer itself** — it only tells you how.

### How GIMP is located

The server finds GIMP automatically, in this order:

1. The `GIMP_CONSOLE_PATH` environment variable, if set.
2. `gimp-console` / `gimp-console-3.2` / `gimp-console-3.0` / … on your `PATH`.
3. Well-known install locations:
   - Windows: `%LOCALAPPDATA%\Programs\GIMP 3\bin\` (winget) and `C:\Program Files\GIMP 3\bin\`
   - macOS: `/Applications/GIMP.app/Contents/MacOS/gimp-console`
   - Linux: `/usr/bin/gimp-console`, and Flatpak (`org.gimp.GIMP`).

If your GIMP is elsewhere, set `GIMP_CONSOLE_PATH` to the full path of the
`gimp-console` executable.

## Tools

All 42 tools below are verified end-to-end against GIMP 3.2.

**Setup & info**

- `gimp_doctor` — detect GIMP; report path/version or install guidance.
- `gimp_version` — report the located GIMP version.
- `install_gimp` — print install instructions for this OS (does not install anything).
- `get_image_info` — dimensions, base type, precision, layer count.
- `list_fonts` — list fonts available to GIMP (optionally filtered by a regex).

**Convert & export** — `convert_format`, `export_as`, `make_thumbnail`,
`batch_convert` (whole folder).

**Geometry** — `resize`, `scale_to_fit`, `crop`, `rotate`, `flip`.

**Color & tone** — `brightness_contrast`, `levels`, `gamma`, `hue_saturation`,
`color_balance`, `desaturate`, `grayscale`, `invert`, `posterize`, `threshold`,
`stretch_contrast`.

**Filters** (GEGL) — `gaussian_blur`, `sharpen`, `median_blur`, `pixelize`, `oilify`,
`emboss`, `edge_detect`, `add_noise`.

**Compose** — `add_text`, `watermark_text` (both take an optional `font` — see
`list_fonts`), `watermark_image`, `overlay_image`, `add_border`, `flatten`.

**Transparency** — `make_transparent` (knock out a solid background colour to alpha),
`add_alpha`. Save to `.png`/`.webp` to keep transparency. Tools that composite (text,
watermarks) preserve an existing alpha channel.

**Escape hatch** — `run_script_fu` — evaluate arbitrary Script-Fu (Scheme) for anything
not covered above.

Most tools take an `inputPath` and an optional `outputPath`. **If `outputPath` is
omitted, the input file is overwritten.** Output format is chosen from the file
extension (`.png`, `.jpg`, `.webp`, `.tiff`, `.bmp`, …).

> Built for **GIMP 3.x** (the Script-Fu calls use the GIMP 3.0 PDB — GEGL filters,
> `gimp-image-get-width`, list-based return values, etc.). Fonts are selectable by name
> via `list_fonts` + the `font` parameter. PDB-discovery tools and per-format quality
> controls are planned follow-ups.

## How it works

For each operation the server spawns:

```
gimp-console -i -d -f --batch-interpreter=plug-in-script-fu-eval \
  -b "(<load → operate → export>)" -b "(gimp-quit 0)"
```

`-i` no interface, `-d` no data, `-f` no fonts (fast startup); the trailing
`(gimp-quit 0)` guarantees the process exits. See the
[GIMP manual](https://www.gimp.org/man/gimp.html) and the
[batch-mode docs](https://docs.gimp.org/3.0/en/gimp-fire-up.html).

> **First-run note:** the very first batch launch on a freshly installed GIMP registers
> every plug-in (writing `pluginrc`) and can take **several minutes on Windows** — long
> enough that an MCP client may report a timeout on the first tool call. To avoid this,
> **launch the GIMP GUI once after installing** (or run `gimp_version`) to pre-build the
> caches. After that, each operation is a quick cold start (a few seconds). GIMP
> invocations are serialised, so concurrent tool calls run one at a time.

## Development

```bash
npm install
npm run build           # tsc -> dist/
npm test                # vitest unit tests
npm run typecheck
node scripts/smoke.mjs   # list tools + run gimp_doctor against the built server
node scripts/verify.mjs  # full image-op battery (requires GIMP installed)
```

## Configuration

| Variable            | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `GIMP_CONSOLE_PATH` | Full path to `gimp-console` if it isn't auto-detected.  |
| `GIMP_MCP_DEBUG`    | Set to `1` to log spawned commands to stderr.           |

## License

MIT © Volare Consulting
