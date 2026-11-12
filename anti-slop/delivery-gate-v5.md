# antislop Delivery Gate: digital bouquet v5, full rewrite (2026-11-12)

Mode: During. **Design Read:** a private apology gift opened from a chat bubble on her iPhone at night, in a quiet editorial language. Instrument Serif is Pipip's voice, JetBrains Mono letters on #0B0A0D are the medium, and integer-scaled pixel art gives the accents. Dials: ENERGY 2 / RHYTHM 1 / MOTION 3.

**Identity motif:** typed letters.
- The question types in.
- The landing dust is "iloveyou" fragments that the gift pulls in.
- The bouquet is written in whole "iloveyou" words.
- Each flower's word lights rose.
- The letter types out.

**References:** DigiBouquet, theBouquet, Aino, ASCII play (Gysin), Anemone, OpenWhen, cbonsai, ASCII Art Archive, plus WebKit source and bug reports for the toolbar tint.

**Evidence:** the browser pane at 375×812, 375×667 and 812×375, using `?debug=1`. iOS Safari itself was not available here.

## The two iPhone bugs
- **Grey square controls:** iOS reused a cached old `styles.css` and old modules.
  - Fix: an import map versions every module (`?v=5a`), and `styles.css?v=5a` too.
  - Inline core CSS draws the controls without any stylesheet.
  - The icons are pixel SVGs that carry their own width, height and fill.
  - The dev server (`tools/serve.py`) sends `Cache-Control: no-store`.
- **Pink toolbar:** Safari tints from fixed edge elements and keeps the old tint after opacity or scale changes.
  - Fix: the `.wipe` element is deleted, and the transition is drawn on the `#fx` canvas (`js/iris.js`).
  - In the pane, every fixed element now has a transparent or #0B0A0D background (checked with `getComputedStyle`).
  - `#bloom` gets an opaque `--bg`.
- **One-time step on the phone:** Settings > Apps > Safari > Advanced > Website Data, delete 192.168.100.2. That clears the copies cached before the fix.

## Block 1: Hard Gate
- R-02 PASS: no em dash in UI text. Signature "Pipip ♡".
- R-03 PASS:
  - No horizontal scroll at 375×812, 375×667 or 812×375.
  - The bouquet fits the safe frame: below the controls (top 56px) and above the dock (bottom 164px).
  - Targets: controls 44×44, chip 56×56 once read, reply 259×56, save 129×44, watch again 121×44, close 44px tall, Yes/No 60px.
- R-17, R-18, R-28, R-36 PASS: no statistics, testimonials, FAQ or claims.
- R-23 / R-38 PASS: all content is the owner's: his letter, his name, Kyla's name (asked for on the tag), his number, his song.
- R-24 PASS: there is no navbar.
- R-25 PASS:
  - White on rose #E06C91 is 3.1:1 at 19px bold, on both Yes and reply (AA large).
  - Muted #9C948C on #0B0A0D is 6.6:1.
  - Chip meta #6E615C on paper is 5.3:1.
  - Rose ♡ #B23A5B on paper is 5.0:1.
- R-26 / R-35 PASS: clicked through.
  - Hold Yes: 56% at 0.5s, then auto-accepts at 0.9s. A tap also accepts.
  - The iris closes, then the gift scene, which opens from the seam.
  - The gift strains: light glyphs, fragments pulled in. Taps add tension. It bursts into the bouquet.
  - The bouquet grows (13 flowers), the paper rises, roots grow, the rose reveal runs, then the finale chip appears.
  - The letter: a dialog opens, focus moves to the paper, it types 257/257, Escape closes it and focus returns to the chip.
  - The dock flips to "read": seal and reply. Reply: `https://wa.me/6282316165567?text=I%20got%20my%20flowers%20%E2%99%A1`.
  - Save: the share sheet or a download (code path; not clicked, because it downloads a file).
  - Watch again: reloads. Tapping adds flowers.
  - Mute and pause toggle aria-pressed.
  - Reduced motion: the full flow ends in the finale.
  - Console: no errors.
- R-27 PASS (no data UI):
  - With no music file, sound effects only.
  - With fonts blocked, a 1.2s font gate then the fallback.
  - With JavaScript off, a noscript message.
- R-32 PASS: every control is native with a visible focus ring. Enter or Space accepts Yes. The letter is a native modal `<dialog>` that closes on Escape and returns focus.
- R-33 PASS: everything is in source; no patch scripts.
- R-34 PASS: a single dark theme by design.
- R-39 PASS:
  - Every control has `cursor: pointer`.
  - The pause and mute labels are fixed; only `aria-pressed` changes.
  - The bouquet canvas is `role="img"` with a description.
  - Decorative canvases are `aria-hidden`; an `sr-only` live region carries the question.
  - Reduced motion removes the ripple, shimmer, sweep, dust drift, twitch and ring.
  - The pause control covers the ambient motion and is not persisted.
  - The page has `lang`, a `<title>`, `<main>` and one `h1`, and doesn't block zoom.
- R-40 PASS:
  - There are no img, video or iframe elements.
  - The only third-party resource is the Google Fonts stylesheet; there are no third-party scripts.
  - Frame times are measured on the dev Mac via `__bouquet.step`: 0.9 to 3.8ms while the bouquet grows, about 2ms at rest. They're not Web Vitals.

## Block 2: Purpose-Gate
- R-01 PASS: there are no page gradients.
- R-04 PASS: pixel-map pause, play and speaker icons in the gift's own pixel language.
- R-06 PASS:
  - Mono, because the ASCII grid needs a fixed advance.
  - Serif, as Pipip's voice.
  - No uppercase wide-tracked labels.
- R-07 PASS: the dust is the identity motif ("iloveyou" fragments), quieter behind the headline.
- R-09, R-10, R-14 PASS: no badges, glass or cards.
- R-12 PASS: shadows only on the paper chip and the letter, which sit above the bouquet.
- R-13 PASS: glow is limited to two uses, the pressed Yes and the burst bloom.
- R-19 PASS: every motion is a beat (entrance, untie, burn, iris, strain, burst, growth, reveal, typing).
- R-22 PASS: the art is the product itself.

## Block 3: Liveliness
- Dials declared and kept. Yes.
- One focal point per screen: headline then question, the gift, the bouquet, the letter, then the reply. Yes.
- Structural whitespace: the black band between the message and the question is where the hearts and smoke play. Yes.
- One accent: rose, only where a heart changes hands. Yes.
- Identity motif carried from the first frame to the last. Yes.

## Block 4: Craftsmanship and Quality Locks
- C-1 to C-5: no.
- R-05: not a template. R-11: two radii (16 and 6). R-15: specific actions. R-16: no buzzwords. R-20: the identity holds. R-21: dark with a reason. R-29: base, ink, paper and one rose (flower colours are content). R-30: not a clone. R-31: reasons are in `styles.css` comments and the v5 prompt. All no.

## Code (antislop-code)
Every rewritten file was checked: there are no banner comments, narration, or vague TODOs. Comments say why (iOS tint, caching, pixel snapping), in one or two lines.

## Not verified here
- On her iPhone: the toolbar colour, the controls, the song starting with the first flower after the Yes unlock, and the share sheet.
- Frame rate on a real phone.
