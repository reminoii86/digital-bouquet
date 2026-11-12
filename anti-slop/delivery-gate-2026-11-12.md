# antislop Delivery Gate: digital bouquet v4 (2026-11-12)

Mode: During. Design Read: a one-person, mobile-first interactive gift (an apology bouquet) for one recipient, in an ASCII-letters-on-black language with pixel-art accents. Dials: ENERGY 2 / RHYTHM 1 / MOTION 3.

Evidence comes from the browser pane at 375×812, 812×375 and desktop width, using `?debug=1`. iOS Safari itself was not available.

## Block 1: Hard Gate
- R-02 PASS: a grep finds no em dash in any .js, .css or .html file. The signature is now "Pipip ♡".
- R-03 PASS:
  - 375×812 and 812×375 have no horizontal scroll. The landscape landing fits: the buttons end at y=281 in a 375px-tall screen.
  - Measured targets: pause 44×44, mute 44×44, watch again 143×44, close 84×44, save/reply 165×48, letter chip 158×59, Yes/No 58px tall.
- R-17 PASS: no statistics anywhere.
- R-18 PASS: no testimonials.
- R-23 PASS: every asset was requested (the gift, the flowers from your references, the tag with your name). There are no logos, avatars or people.
- R-24 PASS: there is no navbar.
- R-25 PASS:
  - Pressed Yes: white on #E06C91 is 3.1:1 at 19px bold (AA large). The old #E8799A was 2.75:1.
  - Paper small text: #6E615C on #F6F0E6 is 5.3:1.
  - Muted text: #9C948C on #0B0A0D is about 6.6:1.
  - Reply button: #3A1820 on #F5C9C0 is about 11:1.
  - Cover: cream on raspberry is about 4.3:1 at 30px.
- R-26 PASS: every control has a real action. See R-35.
- R-27 PASS (no data UI):
  - With no music file, sound effects only.
  - With fonts blocked, the system mono after a 2.5s timeout.
  - With JavaScript off, a noscript message.
- R-28 PASS: there is no FAQ.
- R-32 PASS:
  - Every control is a native button or link with a visible `:focus-visible` ring.
  - Enter or Space on Yes accepts.
  - The letter: focus moves into the paper, Escape closes it, and focus returns to the chip. Verified.
- R-33 PASS: every change is in the source. The OG image generator is an asset script in the scratchpad, not a source patch.
- R-34 PASS: a single dark theme by design; no toggle ships.
- R-35 PASS: run and clicked through:
  - Yes press: rose with white text; release goes to the gift scene. Afterwards `#wipe` is `display:none`, 0px.
  - No: burns, the subtitle swaps, and Yes centres.
  - Gift taps: add tension; burst into the bouquet.
  - Pause: `body.motion-paused`, aria-pressed=true, label "Play animation", remembered. Clicking again resumes.
  - Mute: hidden on the landing, shown afterwards, toggles.
  - Letter chip: opens and types; Escape closes and focus returns to the chip; close works.
  - Reply: `https://wa.me/6282316165567?text=I%20got%20my%20flowers%20%E2%99%A1`.
  - Save: the share sheet or a download (code path checked; not clicked, because it would download a file).
  - Watch again: reloads.
  - Finale taps: add flowers inside the bouquet.
  - Console: no errors, except Chrome's vibrate warnings for simulated taps.
- R-36 PASS: no claims.
- R-37 PASS: the direction comes from your references (painterly, pixel, ASCII, wrapped lilies) and your quiz answers. The Design Read was declared.
- R-38 PASS: everything is real: your letter, your name, your number and your song.
- R-39 PASS:
  - Every control is a native element with `cursor: pointer`, an accessible name (aria-label on the icon buttons), and hover (where hover exists) plus active states.
  - The bouquet canvas is `role="img"` with a description. Decorative canvases are `aria-hidden`.
  - Reduced motion stops the ripple, shimmer, sweep, dust and CSS loops.
  - Ambient motion longer than 5s has a pause control.
  - The page has `lang`, a `<title>`, a `<main>` landmark and one `h1`, and doesn't block zoom.
  - No controls are disabled.
- R-40 PASS:
  - There are no img, video or iframe elements; the canvases are sized by CSS.
  - There are no third-party scripts; only Google Fonts CSS is loaded.
  - Performance numbers are measured, as frame times on the dev Mac via `__bouquet.step`. They're not Web Vitals.

## Block 2: Purpose-Gate
- R-01 PASS: the page background is flat. Gradients exist only inside the painted flowers and paper, which are content.
- R-04 PASS: the only icons are pause/play and speaker, purely functional.
- R-06 PASS:
  - JetBrains Mono, because the ASCII grid needs a fixed-width face, and the controls share it.
  - Instrument Serif, for the handwritten warmth of the letter and headline.
  - Uppercase wide-tracked labels were removed.
- R-07 PASS: the landing's glyph dust foreshadows the letters the bouquet is made of, as the identity motif.
- R-08 PASS: the one ↺, on "watch it again", means replay.
- R-09, R-10, R-14 PASS: no badges, no glass, no cards.
- R-12 PASS: shadows only on the letter chip and the paper, which sit above the bouquet.
- R-13 PASS: glow is limited to two uses, the pressed Yes and the gift icon halo.
- R-19 PASS: every motion is a story beat (press, burn, burst, growth). Ambient loops are pausable and reduced-motion aware.
- R-22 PASS: the pixel gift and ASCII flowers are the product itself.

## Block 3: Liveliness
- Dials declared: ENERGY 2, RHYTHM 1, MOTION 3. Yes.
- Consistent with the dials: four single-purpose full-screen scenes, with choreographed motion. Yes.
- One focal point per screen: headline + Yes, the gift box, the bouquet, the letter. Yes.
- Structural whitespace: black space frames the bouquet. Yes.
- One deliberate accent: rose (Yes, wipe, reply). Yes.
- Identity motif: "iloveyou" letters, from the landing dust to the bouquet to the printed wrap. Yes.
- Design Read declared before building. Yes.

## Block 4: Craftsmanship and Quality Locks
- C-1 to C-5: no.
- R-05: no template layout. R-11: radii vary (18 / 16 / 14 / 8 / round). R-15: the actions are specific ("send a heart back", "save my bouquet"). R-16: no buzzwords. R-20: the identity holds. R-21: a dark default with a reason. R-29: near-black, cream and one rose accent (the flower colours are content). R-30: not a clone. R-31: reasons written in the v4 prompt. All no.

## Comment hygiene (antislop-code)
- 23 box-drawn banner comments became plain labels.
- The em dash in the CSS header comment is gone.
- The numbered "1 · / 2 · / 3 ·" narration comments are now sentences.
- The comment pass touched only comments.

## Not verified here
- **The iOS Safari pink band:** the likely cause (the leftover fixed pink wipe) is fixed, but this was not run on iOS 27.2.
- **Phone frame rate:** frame times above are from the dev Mac. The idle sample (~6ms) was taken while a second tab ran the same animation, so it is inflated; the isolated idle figure last round was ~3ms.
