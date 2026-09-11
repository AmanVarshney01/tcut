## Why

A presenter needs to control a prerecorded demo step by step, speak naturally over it, and record multiple takes without rerunning commands.

## What Changes

- Add `t.step(title, callback, { notes })` for recorded presentation boundaries.
- Add `tcut present` to prepare reusable visual media and open a local presenter workspace.
- Provide step navigation, pause/resume/replay, speaker notes, keyboard controls, full-screen audience output, and an independent synchronized audience window.
- Record repeated takes with exact playback/hold/seek timing and optional microphone audio, persist them locally, review them and export MP4/WebM/GIF.
- Preserve all existing video visuals by preparing source media once; presentation and take export never execute the script.
- Support instant and jittered typing through the existing script settings and presentation command overrides.
- Add documentation, a runnable example, integration tests, and local visual/behavioral verification.

## Capabilities

### Modified Capabilities
- `script-api`: named steps and speaker notes.
- `video-rendering`: reusable presentation media and take exports.

### New Capabilities
- `presentation-mode`: local presenter/audience controls, take recording, persistence and review.

## Constraints

Local work only. Do not push, publish, tag, release, or deploy. Keep package version unchanged.
