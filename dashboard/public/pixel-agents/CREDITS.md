# Pixel Agents — Asset Credits

The pixel-art sprites (characters, floors, walls, bubble designs, and
animation conventions) in this directory were adapted from the **pixel-agents**
project by Pablo De Lucca, licensed under the MIT License.

Upstream repository: https://github.com/pablodelucca/pixel-agents

## Adaptations in ctrl-alt-elite/dashboard

- `characters.png` — single-file 6-character walk sprite sheet (verbatim).
- `characters/char_0.png` through `characters/char_5.png` — per-character
  112×96 sheets (16×32 per frame, 7 frames per row, 3 rows for
  down/up/right directions). Copied verbatim.
- `floors/floor_0.png`, `floors/floor_1.png`, `floors/floor_2.png` — 16×16
  grayscale floor patterns. Copied verbatim.
- `walls/wall_0.png` — wall auto-tile atlas. Copied verbatim.

Code ports live in `dashboard/lib/floor/pixel-agent-*.ts` and are clearly
annotated at the top of each file when they trace back to the upstream
sprite cache / layout engine / bubble renderer.

## MIT License (from upstream LICENSE)

```
MIT License

Copyright (c) 2026 Pablo De Lucca

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
