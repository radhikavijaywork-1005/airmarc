# Gesture Sketch — AI Playground Experiment #2 — Build Brief

## ⚠️ Attribution rule — read first
This is an original build, written from scratch. **No third party's name, username, or site URL from the research below should appear anywhere downstream** — not in code comments, not in the README, not in commit messages, not in the live case-study copy, not in this file going forward. References below are described generically (what pattern was observed, not who built it) for exactly this reason. If you're editing this file later, keep it that way.

## Research this is built on

A few existing portfolio "Playground" experiments use the same core interaction — webcam hand-tracking to draw in the air (point to draw, palm-sweep to erase, pinch to grab/reposition, fist = idle). Multiple designers have independently built this exact demo. It's a validated, genuinely-buildable interaction, but every version of it stops at "point and draw in empty space" — a novelty with no attached problem, a tech demo rather than a product, browser-tab-only.

A related but rejected direction: a webcam-gesture rock-paper-scissors duel game against an AI opponent. Rejected as the base for this experiment because it needs reliable multi-shape gesture *classification* (rock/paper/scissors/thumbs-up) plus a full game state machine (HP, turns, lock-in timing) — meaningfully more fragile to build well than tracking one continuous fingertip position, and a misread gesture in a duel reads as "the game is broken" on a recruiter's first try, which is a worse failure mode than a wobbly line.

This experiment starts from the proven core interaction above (hand-landmark tracking) but is NOT a clone: different positioning, different toolset, different form factor, different reason to exist.

## Problem statement — confirmed

An earlier draft positioned this around "point/circle/annotate during design reviews and screen-shares." That framing turned out to closely duplicate an existing published case study using nearly identical reasoning (a presenter's own account of wanting to point at things on screen during reviews, calling laser pointers and annotation apps clunky). **Do not use that framing, and do not go looking for that case study to reword it slightly differently.**

**The real, distinct problem:** during a live conversation — a meeting, a FaceTime call, any screen-share — an idea is easier to show than describe. But sketching it means breaking the conversation to open a separate drawing app, and once you've sketched it, you still need to save and share it as an actual file. Existing air-draw demos don't solve this either — they're ephemeral canvases; nothing is captured, nothing leaves the tab.

This is meaningfully different from the excluded "point and annotate existing content" framing: this tool **creates something new** (a sketch that didn't exist before) and **produces a persistent artifact** (a saved image you actually share) — not a live pointing gesture that vanishes when you look away. Neither reference site does either of those things.

## What we're building — a web tool, deliberately, not a native app

**Final decision: web tool.** Weighed on its own terms, not to match any other Playground entry — portfolio pieces don't need to look or work like each other; each is shaped by what that specific project needs. For this one: a native app could technically float over FaceTime itself, but a web tool means anyone visiting the portfolio can try it live in their browser right now, no download — that outweighs the native-only overlay trick for this project specifically.

**Visual/UI direction is independent of this decision, and independent of the main portfolio's own brand system.** Do not default to the portfolio's cream/sage/Fraunces look just because it's the same author or the same repo pattern. This tool's UI should be shaped by what a live gesture-drawing tool actually needs to function well: high-contrast tool states so you can tell what's active mid-gesture, a canvas that isn't fighting for attention with decorative chrome, clear real-time feedback for what the hand-tracking is currently reading. Design it as its own thing.

**Be honest about the resulting workflow, in the copy and the UI itself**: this is a companion tool you keep open in its own tab during a call — sketch fast, export the image, then share it the normal way (paste into chat, briefly screen-share the tab). It does not invisibly overlay FaceTime or any other app's window — a browser tab structurally can't do that. That's a fair, honest trade for "try it live," not a lesser version of the pitch — the actual problem (idea → shareable image, fast) is still fully solved.

A hand-gesture-controlled sketch tool with a real toolset — closer to a lightweight Paint app than either reference's single-line demo.

### Core gesture vocabulary (proven base, kept from research)
- **Point** (index finger extended) — draw with the current tool
- **Open palm sweep** — erase
- **Pinch** — grab/move/reposition the last shape or stamp placed
- **Closed fist** — idle/pause (nothing draws)

### Toolset (the actual scope-up from the references — this is what makes it a tool, not a toy)
- **Pencil** — thin, precise line
- **Brush** — thick stroke, soft edge
- **Pen** — uniform bold stroke
- **Shapes** — rectangle, circle, arrow
- **Emoji/stamp tool** — quick reaction stamps (👍 ❌ ⭐ 🔴) dropped via pinch-and-release
- **Color picker** — swap ink color
- **Save/export** — capture the current sketch as an image file (PNG). This is now core, not a nice-to-have — it's the actual point of the tool (see problem statement above).
- **Tool palette is itself gesture-selectable** — point at a tool icon to switch to it. No mouse at any point in the drawing flow.

## What users struggle with (grounding for the toolset choices above)
- Sketching an idea mid-conversation means breaking the call to open a separate app — hence this needs to open and be ready to draw in seconds, not a heavy tool with a learning curve
- Once sketched, an idea still needs to become a file you can actually send — hence save/export is core, not deferred
- Switching tools mid-thought breaks flow — hence gesture-selectable palette, not a keyboard shortcut to remember
- Verbal-only description ("move it a bit left, no, more, like there") is imprecise — hence the arrow/shape tools specifically, not just freehand line

## Design & motion direction — Apple-style interaction, not default web animation

The gesture-driven parts of this app are exactly the category where generic CSS transitions read as cheap and unresponsive. Apply real interaction-design discipline, not just "add some animation":

- **Respond on the instant a gesture is recognized, not after.** The moment a point/palm/pinch/fist transition commits, the UI (cursor dot, active tool highlight) must update that same frame — no waiting for a stroke to finish.
- **Never animate the drawing stroke itself with a CSS transition.** The line follows the fingertip 1:1, every frame, with zero interpolation lag — direct manipulation, not an animated approximation of it.
- **Tool palette selection uses a spring, not a linear fade.** Critically damped (no overshoot) for selecting a tool by pointing at it — `damping 1.0`, fast response (~0.3s). Reserve any bounce/overshoot for something that actually carried gesture momentum, like a stamp being placed with a flick.
- **The floating tool palette itself should read as a real material**, not a flat opaque box: translucent background with `backdrop-filter: blur()`, a bright top edge catching light, content (the canvas/webcam feed) visible and slightly dimmed underneath it — not a solid card sitting on top.
- **The save/export action needs clear, immediate feedback on the same frame it fires** — a visible capture flash or scale-pulse on the canvas the instant the gesture commits, not just a silent file write. This is a moment worth a small delight beat (see: causality + harmony from Apple's audio-haptic guidance — the feedback must fire on the exact frame of the causal action).
- **Respect `prefers-reduced-motion`** — fall back to opacity cross-fades for tool-switching instead of springs/scale for anyone with that preference set.

## Stack
- **Framework**: React + Vite — a standalone deployed web project (same pattern as Aves: its own repo, its own Vercel deployment, linked from the portfolio's `src/data/playground.js` as an external `href`, not embedded in the main portfolio repo)
- **Hand-landmark tracking**: MediaPipe's `FilesetResolver` + `HandLandmarker` (the current vision-tasks API — not the older deprecated "MediaPipe Hands" JS API some tutorials still reference), GPU-accelerated, 21 normalized landmarks per hand. Fully client-side, no backend, no server round-trip.
- **Canvas rendering**: HTML5 canvas layer composited over the webcam `<video>` element
- **Motion**: a spring-capable animation approach (e.g. Framer Motion / Motion for the palette and UI chrome) rather than plain CSS transitions, per the design direction above

## Implementation notes (approach only, not code — write the actual implementation from scratch)
Gesture detection doesn't need ML classification — it's plain landmark-position comparison, which is fast and reliable:
- **Point**: index fingertip above its middle joint (extended), while middle/ring/pinky tips stay below their middle joints (curled)
- **Palm** (erase): all four fingers extended, thumb spread outward
- **Pinch** (grab/place): thumb tip and index tip within a small normalized distance of each other (roughly 0.06 in MediaPipe's 0–1 coordinate space)
- **Fist** (idle): all fingers curled

**Debounce gesture transitions** — raw per-frame detection is jittery. Require a gesture to be consistently detected across ~3–4 consecutive frames before committing to a mode switch, rather than switching on every single frame. This single detail is the difference between a demo that feels responsive and one that feels twitchy/broken.

## Explicitly out of scope for v1
- Floating over other native apps (FaceTime, Zoom) — structurally not possible for a web tool; the honest workflow is "keep this tab open during your call," not an invisible overlay (see positioning note above)
- Screen-capture/compositing onto shared content
- Multiplayer/collaborative annotation
- Voice input or commands
- Cloud sync/history of past sketches — local download only for v1

## Deployment
Standalone project, deployed on its own (Vercel), then linked from the portfolio's `src/data/playground.js` as an external `href` — identical pattern to how the Aves entry (`https://birdssong.vercel.app`) is linked today. Live, try-it-yourself on the portfolio, same as Aves — not a demo video.

## Reference — pattern only, NOT to fork or copy code from
This is an original build. The existing air-draw browser demos are prior art studied for the gesture vocabulary and to confirm hand-tracking is genuinely buildable — not a codebase to start from. Write it from scratch.
