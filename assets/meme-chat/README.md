# MemeCatch chat mascot

Generated using the built-in imagegen tool, then assembled with FFmpeg. The source sheet is `mascot-sheet.png`; public deliverables are `public/images/meme-chat/mascot-wave.gif` and `mascot-idle.png`.

Generation prompt:

> Create a transparent 4-column by 4-row uniform sprite sheet of 16 frames with no grid, text, labels or watermark. Each cell has the same original small orange chat-flame mascot for a Korean meme dictionary: tangerine speech-bubble body, flame tuft, ivory inset face, dark oval eyes, happy mouth, tiny hands and feet, polished clay/vinyl style. Fixed front three-quarter camera, identical scale and center, transparent cell padding. In reading order, gently raise the right hand, wave, blink, wave again and lower back to the starting pose. Subtle breathing, distinct poses, seamless loop, no extra objects or background.

Cleanup prompt:

> Preserve all 16 poses, character identity and equal grid placement. Remove stray colored speckles, floating pixels, glow and haze outside the silhouettes. Keep a genuinely transparent background and antialiased edges, no color fringes, no scene or labels. Alpha cleanup only, no redesign.

Assembly: scale sheet to 1280×1280, FFmpeg `untile=4x4`, scale each cell to 160×160 with Lanczos. Encode at 8 fps with transparent palette and infinite looping (`palettegen=reserve_transparent=1`, `paletteuse=dither=sierra2_4a:alpha_threshold=128`, `-loop 0`). Use the first frame as the static reduced-motion image. The GIF contains 16 frames over approximately two seconds; normal avatars render it at 34–58 CSS pixels.
