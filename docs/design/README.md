# VE HR designs

Source of the Phase 1 screen mockups. Each folder is the file set of a Claude design canvas: `canvas.json` lays out the artboards and each `*.dc.html` is one screen. The files render inside the canvas (they load its `support.js`), not as standalone pages.

| Folder     | Canvas                                                                     | What it shows                                                                                              |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `screens/` | [VE HR Phase 1 Screens](https://claude.ai/artifact/FDSYHYaeaDv17m73TMDooD) | All 15 Phase 1 screens in the Site Ledger theme: worker app (8), admin on the phone (3), web dashboard (4) |
| `themes/`  | [VE HR Theme Options](https://claude.ai/artifact/CTfrARgwegu4xFGgtYQR8C)   | Four themes side by side on the same three screens                                                         |

## Themes

**Chosen for Phase 1: Site Ledger.** The others are kept for reference.

Every theme keeps the same meaning for colour: green is check in, orange is check out, amber is a warning. Only the look changes.

| Token                  | Site Ledger           | Night Shift           | Hi-Vis                               | Blueprint                   |
| ---------------------- | --------------------- | --------------------- | ------------------------------------ | --------------------------- |
| Background             | `#F4F1EA`             | `#111315`             | `#FFFFFF`                            | `#EEF2F7`                   |
| Surface                | `#FFFFFF`             | `#1C1F22`             | `#FFFFFF` (2px `#111111` border)     | `#FFFFFF`                   |
| Text                   | `#1B1D1F`             | `#F2EFE8`             | `#111111`                            | `#0E2238`                   |
| Muted text             | `#4A4944`             | `#B4AFA4`             | `#3F3F3F`                            | `#4A5B70`                   |
| Brand / highlight      | `#1B1D1F`             | `#3CC47F`             | `#FFD60A`                            | `#123A66`                   |
| Check in (text on it)  | `#1E6B45` (white)     | `#3CC47F` (`#062515`) | `#0A7A3B` (white)                    | `#0F7A5C` (white)           |
| Check out (text on it) | `#B8480F` (white)     | `#F29A4A` (`#2A1203`) | `#C2410C` (white)                    | `#C2410C` (white)           |
| Warning bg / text      | `#FCEBD0` / `#5A2E00` | `#3A2A10` / `#F5C77A` | white + `#C2410C` border / `#9A330A` | `#FDF0E1` / `#6E2E05`       |
| Headings               | Archivo 800           | Archivo 800           | Barlow Condensed 800, uppercase      | IBM Plex Sans Condensed 700 |
| Body                   | Public Sans           | Public Sans           | Barlow                               | IBM Plex Sans               |
| Numbers / times        | IBM Plex Mono         | IBM Plex Mono         | IBM Plex Mono                        | IBM Plex Mono               |
| Corners                | 12–24px               | 12–24px               | 6–10px, hard offset shadow           | 12–16px                     |

Worker check-in / check-out button: 150px tall, full width, icon 40px over a 30–38px label.
