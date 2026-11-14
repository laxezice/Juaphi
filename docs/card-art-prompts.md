# Prompt ภาพการ์ด จั่วผี (สำหรับให้ Codex สร้างภาพ)

## วิธีใช้
- สร้างภาพทีละใบ ทุกใบเป็น **PNG แนวตั้ง 750×1050 px (สัดส่วน 5:7)**
- บันทึกไฟล์ไว้ที่ `public/cards/<id>.png` ตามชื่อที่ระบุในแต่ละหัวข้อ วางไฟล์แล้วเกมจะใช้ภาพนั้นเลย ไม่ต้องแก้โค้ด
- ภาพต้อง **ไม่มีตัวอักษรใดๆ** เพราะเกมจะเขียนชื่อการ์ดทับเองที่แถบล่างของการ์ด เว้นพื้นที่ล่างของภาพประมาณ 25% ให้เรียบและมืดกว่าส่วนอื่น
- ทุก prompt ด้านล่างมีสไตล์ร่วมใส่ไว้ครบแล้ว คัดลอกไปใช้ทั้งก้อนได้เลย

**สไตล์ร่วม** (ใส่อยู่ในทุก prompt แล้ว ไม่ต้องเติมเอง)
> Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful (not gory, no blood), dark moody palette of deep indigo, black and aged teak brown with warm candlelight orange-gold accents and eerie pale green spirit glow, soft rim lighting, slightly stylized characters with expressive faces, rich texture like gouache on paper, centered composition with a single clear subject readable at small size on a phone, plain dark vignette in the bottom quarter of the image, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.

---

## `back` หลังการ์ด → `public/cards/back.png`
```
Card back design for a party card game, Thai haunted house folklore theme. Perfectly symmetrical ornamental pattern: a central circular sacred yantra-like geometric diagram drawn in glowing gold ink lines (abstract geometric strokes and dots only, no readable script, no letters), surrounded by concentric rings of Thai-style flame motifs (kranok-inspired curls), four small melting candles in the corners with warm glow, background deep oxblood red fading to black, subtle aged paper texture. Painterly digital illustration, rich gouache texture, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border.
```

## `ghost` ผี → `public/cards/ghost.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful (not gory, no blood). Subject: a tall pale female ghost with very long black hair covering most of her face, one glowing eye visible through the hair, wearing a tattered faded white Thai-style dress, bursting out from the dark toward the viewer with arms reaching forward, wisps of pale green spirit mist swirling around her, a candle in the foreground just blown out with a curl of smoke. Dramatic, the scariest card of the deck but still stylized and fun. Dark moody palette of deep indigo and black with eerie pale green glow and a hint of candle orange, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `talisman` ยันต์ → `public/cards/talisman.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: a square sacred cloth talisman (pha yant) floating upright in the center, faded cream fabric with glowing gold sacred geometric diagrams (abstract lines, circles and dots only, no readable script, no letters), radiating a warm protective golden light that pushes back swirling pale green ghost mist at the edges of the image, a few tiny sparks of gold. Hopeful, protective mood. Dark indigo background, warm candlelight orange-gold accents, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `nope` ไม่! → `public/cards/nope.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: a bold close-up of a human hand thrust toward the viewer, palm open in a firm "stop" gesture, white sacred cotton thread (sai sin) wrapped around the wrist glowing softly, a shockwave of golden light from the palm blasting a small surprised ghost backwards out of frame. Energetic, decisive, comedic. Dark indigo background, warm candlelight orange-gold accents and eerie pale green ghost glow, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `sneak` ย่องหนี → `public/cards/sneak.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: a nervous young Thai person in a sarong and t-shirt tiptoeing exaggeratedly past a sleeping translucent ghost slumped in an old wooden chair, holding a small oil lantern low and covering its light with one hand, sweat drop on their forehead, creaky teak floorboards of an old Thai wooden house, moonlight through window slats. Comedic sneaking pose. Dark indigo palette, warm lantern orange glow, eerie pale green ghost glow, soft rim lighting, gouache texture, clear subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `curse` สาปส่ง → `public/cards/curse.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful (no gore). Subject: a mischievous old sorcerer's hand pointing forward, a single thick ribbon of swirling purple-black curse smoke with tiny skull-shaped wisps flying out of the frame to the right, a small straw effigy doll dangling from the sorcerer's other hand, flickering candle beside. Sneaky, vengeful but funny mood. Dark indigo and black palette with purple curse glow and warm candle orange accents, soft rim lighting, gouache texture, clear subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `curse2` สาปส่ง ×2 → `public/cards/curse2.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful (no gore). Subject: the same mischievous old sorcerer as a stronger version: both hands raised, two huge intertwined ribbons of purple-black curse smoke with skull-shaped wisps spiraling out of the frame to the right, two straw effigy dolls floating in the air, the candle flame turned violet and flaring tall. More intense and dramatic than a normal curse, cackling expression. Dark indigo and black palette with strong purple curse glow and warm orange accents, soft rim lighting, gouache texture, clear subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `mirror` ส่องกระจก → `public/cards/mirror.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: an antique carved teak standing mirror with ornate Thai-style frame, its glass glowing pale green, showing three face-down playing cards floating inside the reflection, one slightly turned to reveal a faint ghostly silhouette, a candle in front of the mirror reflected in the glass. Mysterious, fortune-telling mood. Dark indigo palette, warm candle orange-gold accents, eerie pale green glow, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `wind` ลมพัด → `public/cards/wind.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: a sudden supernatural gust of wind bursting through the open wooden shutters of an old Thai house, a tornado-like swirl of playing cards (face-down, blank backs) spinning in the center, white curtains flapping, candle flames bent sideways, a few dry leaves and a startled tiny ghost tumbling in the whirlwind. Chaotic, dynamic motion. Dark indigo palette, warm candle orange accents, pale green spirit glow in the wind streaks, soft rim lighting, gouache texture, clear subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## `beg` ขอของ → `public/cards/beg.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful. Subject: a small skinny translucent ghost with big pleading puppy-dog eyes, kneeling and holding out a chipped clay alms bowl with both hands toward the viewer, as if begging for something, faint pale green glow, sitting on old teak floorboards next to a single candle. Pitiful and funny, endearing. Dark indigo palette, warm candle orange-gold accents, eerie pale green ghost glow, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## ผีน้อย 5 แบบ (ไม่มีความสามารถในตัว ใช้จับคู่) ให้ดูน่ารักกว่าการ์ดอื่น แต่ละใบต้องแยกกันออกง่ายในพริบตา

### `imp1` ผีน้อย · กุมารทอง → `public/cards/imp1.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary). Subject: a small golden-skinned spirit child (kuman thong) with a traditional topknot hairstyle and a red cloth belt, sitting cross-legged and grinning mischievously while hugging a small toy, surrounded by a soft golden glow, a little offering of sweets and a red soda bottle with a straw beside him. Main color accent: warm gold. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `imp2` ผีน้อย · กระสือ → `public/cards/imp2.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary, no gore, no organs). Subject: a cute floating female head (krasue) with big round eyes and a shy smile, long black hair, trailing a soft glowing ribbon of icy blue-white light beneath her instead of a body, hovering over a dark rice field at night with fireflies. Main color accent: icy blue-white glow. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `imp3` ผีน้อย · กระหัง → `public/cards/imp3.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary). Subject: a goofy little man-ghost (krahang) flying clumsily over a moonlit village, using two woven bamboo rice-winnowing baskets strapped to his arms as wings and a wooden rice pestle as a tail, wide surprised eyes, sarong flapping. Main color accent: straw yellow and moonlight blue. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `imp4` ผีน้อย · ปอบ → `public/cards/imp4.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary, no gore). Subject: a chubby, greedy little ghost (phi pop) with a huge grin, sneakily raiding a kitchen at night, cheeks stuffed full, hugging a stolen grilled chicken and a basket of sticky rice, crumbs everywhere, glowing red eyes but a silly expression. Main color accent: hungry crimson red. Dark indigo background, warm orange kitchen fire glow, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `imp5` ผีน้อย · ตานี → `public/cards/imp5.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary). Subject: a gentle small female banana-tree spirit (nang tani) in a green traditional Thai sabai dress, peeking shyly from behind a large banana leaf, holding a banana bunch, soft green moonlit glow among banana trees at night. Main color accent: fresh leaf green with pale moonlight. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

## การ์ดเสริม (เปิดในห้องด้วยตัวเลือก "การ์ดเสริม")

### `blackout` ไฟดับ → `public/cards/blackout.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: a dark room in an old Thai wooden house the instant a candle goes out, a thin curl of smoke rising from the wick, several hands reaching in from the edges of the darkness and swapping playing cards with each other, only wide startled eyes visible. Main color accent: deep violet darkness with a faint smoke-grey glow. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `possess` ผีเข้า → `public/cards/possess.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: a villager sitting stiffly with eyes rolled up and hair standing on end while a translucent green spirit swirls into his body, his hand drawing a card from a deck as if pulled by strings. Main color accent: eerie spirit green. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `grave` ขุดหลุมศพ → `public/cards/grave.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: a nervous little gravedigger with a hoe digging up a mound of earth under a big old tree at night, old weathered cards poking out of the soil, fireflies floating around. Main color accent: earthy brown with firefly yellow. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `fate` ผูกดวง → `public/cards/fate.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: an old Thai fortune teller tying a red sacred thread that links three floating cards in a row, incense sticks smoking and a yantra cloth behind her. Main color accent: sacred-thread red with incense gold. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `reverse` เดินถอยหลัง → `public/cards/reverse.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: a timid character tiptoeing backwards out of the doorway of a haunted house, a swirling curved arrow of mist looping back the other way, nervous expression. Main color accent: cool moonlit blue. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `bottom` จั่วก้นกอง → `public/cards/bottom.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, playful spooky (cute, not scary, no gore). Subject: a sneaky hand slipping the very bottom card out from under a tall stack of cards, while a small ghost lies in wait curled on top of the stack, unaware. Main color accent: mischievous purple. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `wild` ผีน้อย · แปลงร่าง (ใช้แทนผีน้อยแบบไหนก็ได้) → `public/cards/wild.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, cute and playful spooky (chibi proportions, not scary). Subject: a small round mischievous shapeshifter ghost caught mid-transformation inside a swirl of colorful smoke, its body morphing between five little Thai spirits at once: a golden topknot on its head, a trail of icy blue-white glow below, one arm turning into a woven bamboo winnowing-basket wing, one glowing red eye, and a banana leaf wrapped around it like a cape, grinning proudly. Main color accent: rainbow-tinted smoke swirling gold, blue, red and green. Dark indigo background, soft rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```

### `evil` ผีร้าย (ตัวเลือกห้อง: จั่วได้ต้องใช้ยันต์ทั้งหมดในมือ) → `art/evil.png`
```
Painterly digital illustration for a party card game, Thai haunted house folklore theme, spooky but playful (not gory, no blood). Subject: a towering furious vengeful spirit, darker and more menacing than an ordinary ghost, long wild black hair whipping upward, burning crimson eyes, tattered black-red Thai-style garment, clawed hands tearing several glowing golden cloth talismans to shreds, scraps of the talismans scattering and burning into ash around her, a broken spirit-house shrine behind her. The most dangerous card in the deck. Deep black and blood-crimson palette with smouldering ember orange and fading gold sparks, strong red rim lighting, gouache texture, centered single subject readable at small size on a phone, plain dark vignette in the bottom quarter, portrait 5:7, 750x1050, absolutely no text, no letters, no numbers, no watermark, no border, no frame.
```
