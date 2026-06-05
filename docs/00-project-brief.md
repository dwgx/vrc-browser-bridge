# Project Brief

## Problem

VRChat users want a shared browser that multiple people can see and control inside a world.

VRChat cannot natively host a real browser in a world. There is no official WebView, CEF, DOM, JS runtime, or webpage rendering API for Udon worlds.

## Product Direction

Build a shared browser terminal:

- One real Chromium session exists outside VRChat.
- Its video is streamed into VRChat.
- VRChat captures user input and forwards it to the browser controller.
- Everyone watches and manipulates the same authoritative browser session.

## Desired User Experience

In VRChat:

- A big screen shows the live browser.
- Users can point at the screen with a laser pointer.
- Users can click, scroll, type text, submit URLs, and use back/forward/refresh.
- Users see who currently has control.
- Users can request control.
- Host can lock, unlock, reset, or close the session.

Outside VRChat:

- Host runs Companion.
- Companion shows connection state, session code, current stream URL, and browser status.

## Important Principle

Do not synchronize multiple browsers. Synchronize input into one authoritative browser.

```text
many users -> one input arbiter -> one browser -> one video stream
```

## MVP Definition

MVP means:

- A local Chromium browser can be controlled from JSON events.
- A mock page can generate the same events Unity will later generate.
- Browser video can be pushed to MediaMTX and viewed as RTSP.
- A fake or real VRChat output log can be tailed by Companion.

Unity world work starts after this core loop is reliable.
