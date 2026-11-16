# Website backgrounds

Generated with the built-in ImageGen tool on 2026-11-17. Reference images supply the established clean 2D cartoon style; these are scenery assets without baked-in UI.

| Use | Original (local, Git-ignored) | Web asset |
| --- | --- | --- |
| Game, landscape | `art/backgrounds/game.png` | `public/backgrounds/game.webp` |
| Game, portrait | `art/backgrounds/game-mobile.png` | `public/backgrounds/game-mobile.webp` |
| Home and waiting lobby | `art/backgrounds/home.png` | `public/backgrounds/home.webp` |

Game imagery keeps the middle and hand area quiet. CSS selects a separately composed portrait image by viewport orientation, uses cover without stretching, and adds a restrained dark overlay. Home/lobby share the exterior scene, with a stronger lobby overlay and a right-biased mobile crop. All URLs receive the existing server version parameter. Original images live in a subfolder so the card-export script does not treat them as cards.

Web assets use WebP quality 85. The existing blackout pseudo-element and all board interactions remain intact.

## Game landscape prompt

Create one finished landscape 16:9 background illustration for the existing Thai ghost party card game Jua Phi. The two provided images are STYLE REFERENCES ONLY: match their clean bold dark outlines, simple broad color shapes, restrained cel shading, cute playful Thai spooky cartoon style. Do not copy their foreground characters or cards. This is the GAME TABLE / GAME ROOM background behind real interactive cards. Scene: looking slightly downward into a traditional Thai wooden haunted house at night, an expansive empty dark indigo-teal wooden floor occupies 80 percent of the composition, with just a subtle few wide floorboard seams, almost flat and very low contrast in the central two thirds and lower central area. At the extreme left and right edges, cropped chunky wooden posts and a few banana leaves frame the space; small golden candles and a tiny friendly mint spirit glow near the far side edges. A narrow shadowy Thai wooden wall and simple slatted windows run along only the upper 15 percent. Palette midnight navy, muted deep teal, warm dark teak brown, tiny restrained amber candlelight accents. Cozy mischievous haunted-house atmosphere, readable at phone size, polished 2D game environment. Keep the central 70 percent calm and dark with no objects because UI will overlay it. Peripheral scenery should remain recognizable at widescreen but safe to crop to mobile portrait. No large moon or bright lights at center, no focal character, no table rectangle, no furniture in center, no cards, no UI, no buttons, no text, no letters, no numbers, no watermark, no border. Full bleed opaque background, landscape 16:9, ideally 1920x1080.

Style references: `art/imp2.png`, `art/blackout.png`.

## Game portrait prompt

Adapt this background to a PORTRAIT 9:16 mobile game screen, ideally 1080x1920. The provided image is the exact environment/style reference. Preserve the same clean cartoon Thai haunted wooden room, navy-teal floor, thick dark outlines, amber candlelight and mint friendly spirit. Recompose rather than simply crop: slender dark wooden posts hug the extreme left and right edges, simplified slatted wall/windows only occupy the upper 18 percent, two tiny candles at the upper side corners and one tiny mint ghost peeking at upper right. A few small cropped banana leaves only at outer corners. The entire middle and bottom 75 percent is empty dark blue-teal floor with only 4 to 5 very subtle horizontal floorboard seams; wide calm empty area for real interactive cards. Keep all ornament compact, tucked into narrow 10 percent side borders, not intruding into center. Keep the contrast low and central lighting gently teal. Full bleed opaque environment background. No cards, no table, no game UI, no text, no letters, no numbers, no logo, no watermark. Maintain style and palette of reference precisely, do not add new characters or objects.

Environment reference: `art/backgrounds/game.png`.

## Home/lobby prompt

Create one finished landscape 16:9 full-bleed background illustration for the homepage and waiting lobby of Jua Phi, a cute Thai ghost party card game. The supplied images are STYLE REFERENCES ONLY. Match their polished clean 2D cartoon artwork: bold dark outlines, large simple shapes, restrained cel shading, cute spooky Thai folklore, warm highlights, no photorealism or painterly noise. Scene: approach to an old traditional Thai teak haunted house at night. A crooked Thai gabled roof and warm lantern-lit porch appear at the far upper right; thick simplified banana leaves frame the left and right borders; a small Thai spirit-house shrine and one tiny friendly mint ghost sit at the far lower right edge. Deep navy indigo sky, muted purple shadows, warm amber windows, a few green fireflies close to the foliage. This is a quiet atmospheric WEBSITE BACKDROP, not a busy poster. Reserve the entire central 65 percent and left-middle for overlay HTML content: broad soft near-dark shapes, no prominent focal object there. Detailed scenery restricted mainly to outer 15 percent edges and upper-right, low contrast overall. Bottom fades naturally into very dark indigo ground, large uninterrupted quiet central area. The image must work cropped to portrait mobile as well as wide desktop; no important centered illustration. Playful inviting haunted-house atmosphere consistent with existing cards. No cards, no hands, no gameplay table, no people, no text, no lettering, no numbers, no logo, no watermark, no UI elements, no border, no frame. Full opaque background. Wide landscape 16:9 ideally 1920x1080.

Style references: `art/imp2.png`, `art/blackout.png`.
