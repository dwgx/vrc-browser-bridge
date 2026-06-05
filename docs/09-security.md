# Security

This project controls a real browser in a shared public space. Treat it as security-sensitive.

## Main Risks

- Everyone can see the browser screen.
- Users may type private credentials into a shared session.
- Malicious websites may attempt browser escape or phishing.
- Public users may spam input events.
- A hostile world/player may forge events.
- Browser automation endpoints are dangerous if exposed.

## Rules

- Do not store browser profiles by default.
- Do not store VRChat credentials.
- Do not expose CDP/Playwright ports publicly.
- Do not trust VRChat display names.
- Do not trust event player IDs sent by clients.
- Do not execute shell commands from browser events.
- Do not allow local file access through the browser.

## Browser Isolation

For cloud mode:

- one isolated container/VM per session
- ephemeral profile by default
- no privileged containers
- restricted egress
- block cloud metadata addresses
- kill browser and delete profile on session end

## Control Safety

Add:

- session code
- host approval
- control lock
- per-player rate limits
- event sequence numbers
- event deduplication
- emergency stop

## Login Warning

Any login shown in the shared browser is visible to everyone watching.

The UI should warn users before typing passwords or private information.

## Moderation

Public service mode needs:

- room owner controls
- domain blocklist/allowlist options
- NSFW/illegal content policy
- abuse reporting
- ability to terminate sessions
