# Research Sources

These are the most important sources and conclusions.

## VRChat Constraints

VRChat whitelisted world components:

- https://creators.vrchat.com/worlds/whitelisted-world-components/

Conclusion:

- Worlds are component-whitelisted.
- WebView/CEF/Chromium is not a world capability.

VRChat video players:

- https://creators.vrchat.com/worlds/udon/video-players/

Conclusion:

- Use AVPro for livestreams.
- New video URL loading is rate-limited.
- Video player is not a browser.

VRChat video URL whitelist:

- https://creators.vrchat.com/worlds/udon/video-players/www-whitelist/

Conclusion:

- Some domains are trusted.
- Untrusted URLs require user setting.
- Android/Quest constraints matter later.

Image loading:

- https://creators.vrchat.com/worlds/udon/image-loading/

Conclusion:

- VRCImageDownloader is too slow for realtime browser display.

String loading:

- https://creators.vrchat.com/worlds/udon/string-loading/

Conclusion:

- VRCStringDownloader is too slow for realtime control.

Udon networking:

- https://creators.vrchat.com/worlds/udon/networking/
- https://creators.vrchat.com/worlds/udon/networking/events/
- https://creators.vrchat.com/worlds/udon/networking/variables/
- https://creators.vrchat.com/worlds/udon/networking/ownership/

Conclusion:

- Good for world state and compact input events.
- Not suitable for arbitrary high-bandwidth external networking.

VRChat logs:

- https://docs.vrchat.com/docs/local-vrchat-storage

Conclusion:

- Local output logs can be tailed by Companion.

OSC:

- https://docs.vrchat.com/docs/osc-overview
- https://docs.vrchat.com/docs/osc-avatar-parameters

Conclusion:

- OSC is not a general Udon world outbound transport.

## Media

MediaMTX:

- https://mediamtx.org/docs/kickoff/introduction
- https://mediamtx.org/docs/usage/read
- https://mediamtx.org/docs/features/scalability

Conclusion:

- Best first media router for RTSP output to VRChat.

OBS SRT:

- https://obsproject.com/kb/srt-protocol-streaming-guide

Conclusion:

- Useful for ingest, not final VRChat playback.

FFmpeg protocols:

- https://ffmpeg.org/ffmpeg-protocols.html

Conclusion:

- Useful for RTSP publish and automated capture.

AVPro supported media:

- https://www.renderheads.com/content/docs/AVProVideo-v3/articles/supportedmedia.html

Conclusion:

- RTSP is the practical PCVR low-latency target.

## Browser Control

Playwright:

- https://playwright.dev/

Chrome DevTools Protocol:

- https://chromedevtools.github.io/devtools-protocol/

Conclusion:

- Use Playwright/CDP to control Chromium.
- DOM/accessibility inspection is better than OCR for core control.

## Optional Browser-in-the-Cloud

Hyperbeam:

- https://docs.hyperbeam.com/

Conclusion:

- Useful for rapid validation of shared cloud browser UX.
- Not ideal as final core because VRChat cannot directly consume WebRTC as a world video stream.
