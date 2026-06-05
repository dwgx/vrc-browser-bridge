# Browser Controller

## Goal

Control one authoritative Chromium session.

Do not create one browser per viewer. Everyone sends input to the same session.

## Recommended Tools

Use Playwright and Chrome DevTools Protocol.

Playwright handles:

- launching Chromium
- navigation
- typing
- mouse click
- wheel
- page lifecycle

CDP can later handle:

- lower-level input
- screenshots
- accessibility tree
- DOM inspection
- browser instrumentation

## MVP Operations

Required:

- `url_submit`
- `pointer_down`
- `pointer_up`
- `pointer_move`
- `wheel`
- `text_commit`
- `nav_back`
- `nav_forward`
- `reload`

## Coordinate Mapping

Events use normalized screen coordinates:

```text
browserX = event.x * viewportWidth
browserY = event.y * viewportHeight
```

Use a fixed browser viewport for MVP, for example:

```text
1280x720
```

Later support:

- 1920x1080
- high DPI scaling
- letterboxing/cropping correction
- VRChat screen aspect ratio metadata

## Text Input

For MVP, prefer text commit:

```text
VRChat text input -> text_commit -> Playwright keyboard.insertText
```

Individual key events are harder in VRChat and should come later.

## DOM and OCR

OCR is not the foundation.

Because we control Chromium, we can inspect:

- DOM
- accessibility tree
- focused element
- element bounding boxes

This is more reliable than OCR for browser automation.

OCR and vision should be added later for AI assistant features.
