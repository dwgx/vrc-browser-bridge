# AI and OCR Future

OCR is useful, but it is not the foundation of the project.

## Why OCR Is Not First

The browser is controlled externally, so the system can inspect Chromium directly:

- DOM
- accessibility tree
- focused element
- visible text
- element coordinates
- screenshots

This is more accurate than OCR.

## Where OCR Helps

OCR and vision can later power AI assistance:

- read a webpage aloud or summarize it
- identify visible buttons
- help users find a link
- compare visual page state to expected state
- assist with pages where DOM is difficult, canvas-heavy, or remote-rendered

## Best Future AI Stack

Use combined context:

```text
DOM text
+ accessibility tree
+ screenshot
+ OCR result
+ user voice/text request
= AI browser assistant
```

Example user intents:

- "Click the login button."
- "Find the download link."
- "Summarize this page."
- "Fill this form using these values."
- "Explain what this error means."

## Implementation Later

Add a Browser Observer module:

- captures screenshot
- extracts DOM and accessibility tree
- optionally runs OCR
- sends compact page state to AI
- returns proposed action
- asks host for confirmation before risky actions

Never let AI freely operate authenticated sessions without explicit user control.
