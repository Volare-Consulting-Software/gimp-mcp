# gimp-mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants (Claude
Desktop, Claude Code, and any other MCP client) edit images with
[GIMP](https://www.gimp.org).

Unlike most GIMP MCP servers, `gimp-mcp`:

- is a plain **npm package** — run it with `npx gimp-mcp`, no Python environment;
- needs **no custom GIMP plug-in** — it drives GIMP's built-in headless **Script-Fu
  server**, keeping one GIMP process alive as a **live session**;
- works on **Windows, macOS, and Linux**, and points you to the right installer if GIMP
  isn't present (`gimp_doctor` / `install_gimp`).

The tools are **atomic GIMP operations** — the same single actions a person performs in
the GIMP UI (open an image, add an alpha channel, fuzzy-select, clear, add a text layer,
scale, export, …). The assistant composes them, and **all state persists between calls**
(open images, selections, layers, colours) — exactly like working in GIMP. There are no
"do-everything" wrapper tools.

Example — make a logo's background transparent and caption it, the way you would in GIMP:

```
open_image("logo.png")            -> image 1
add_alpha_channel(1)
fuzzy_select(1, x=4, y=4, threshold=0.2)   # magic-wand the corner background
edit_clear(1)                     # erase it to transparency
select_none(1)
add_text_layer(1, "Super Diego", font="Times New Roman", x=430, y=672)
merge_visible(1)                  # keep the alpha channel
export_image(1, "logo_final.png")
```

## Requirements

- **Node.js ≥ 18**
- **GIMP 3.x** installed (verified against GIMP 3.2; the tools use the GIMP 3.0 PDB). See
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

Each tool is one GIMP operation. Tools that act on a layer take a `layerId` (from
`get_image_info`) and default to the image's top layer when omitted. All verified against
GIMP 3.2.

**Setup & session** — `gimp_doctor`, `gimp_version`, `install_gimp` (instructions only),
`end_session` (reset the live GIMP process).

**Images** — `open_image`, `new_image`, `export_image`, `duplicate_image`, `close_image`,
`list_images`, `get_image_info`, `list_fonts`.

**Selection** — `select_all`, `select_none`, `select_invert`, `select_rectangle`,
`select_ellipse`, `select_by_color`, `fuzzy_select` (magic wand), `select_grow`,
`select_shrink`, `select_feather`. Selection tools take a `mode` (replace/add/subtract/
intersect).

**Edit & context** — `edit_clear`, `edit_fill`, `bucket_fill`, `set_foreground`,
`set_background`, `set_sample_threshold`, `set_opacity`.

**Layers** — `add_alpha_channel`, `new_layer`, `add_layer_from_file`, `add_text_layer`
(with `font` — see `list_fonts`), `set_layer_opacity`, `set_layer_offsets`,
`delete_layer`, `merge_visible` (keeps alpha), `flatten` (drops alpha).

**Transform** — `scale_image`, `crop_image`, `resize_canvas`, `rotate_image`,
`flip_image`.

**Colour & filters** — `brightness_contrast`, `levels`, `hue_saturation`,
`color_balance`, `desaturate`, `invert`, `posterize`, `threshold`, `convert_grayscale`,
and `apply_gegl_filter` — the **generic** filter tool (any `gegl:*` operation with its
properties, e.g. `gegl:gaussian-blur` `{ "std-dev-x": 5, "std-dev-y": 5 }`).

**Escape hatch** — `run_script_fu` — evaluate arbitrary Script-Fu in the same live
session, mixing freely with the tools above.

## How it works

On first use the server starts one `gimp-console` running GIMP's built-in Script-Fu TCP
server and connects to it. Each tool sends a single Script-Fu (PDB) command over the
socket and reads the result; the GIMP process stays alive, so every open image,
selection, and layer **persists between tool calls** — a true session, not file-in /
file-out. See the [GIMP manual](https://www.gimp.org/man/gimp.html) and the
[Script-Fu server docs](https://developer.gimp.org/resource/script-fu/).

> **First-start note:** the very first session start on a freshly installed GIMP registers
> every plug-in and loads all data/fonts — **30-60s on Windows** (longer on a cold cache).
> The server is started eagerly when the MCP launches to hide this, but the first tool call
> may still wait. After that, operations are near-instant (~10 ms each). Launching the GIMP
> GUI once after install also warms the caches.

## Development

```bash
npm install
npm run build            # tsc -> dist/
npm test                 # vitest unit tests
npm run typecheck
node scripts/smoke.mjs    # list tools + run gimp_doctor against the built server
node scripts/refine.mjs   # end-to-end: open a logo, knock out bg, add a caption (needs GIMP)
```

## Configuration

| Variable            | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `GIMP_CONSOLE_PATH` | Full path to `gimp-console` if it isn't auto-detected.   |
| `GIMP_MCP_PORT`     | TCP port for the Script-Fu session (default `10008`).    |
| `GIMP_MCP_DEBUG`    | Set to `1` to log every Script-Fu command to stderr.     |

## License

MIT © Volare Consulting
