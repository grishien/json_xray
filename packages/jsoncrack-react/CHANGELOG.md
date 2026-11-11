# Changelog

All notable changes to `jsoncrack-react` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-09-14

### Fixed

- `onCollapseChange` now fires after commit instead of from inside a state
  updater, so consumers that write to a store in the callback no longer
  trigger React's "Cannot update a component while rendering a different
  component" warning. It also fires when collapsed paths are pruned after a
  JSON edit, so the reported list always matches what is rendered.

## [1.0.3] - 2026-04-10

### Fixed

- Object rows with an empty-string key (e.g. `{"": [1, 2]}`) no longer render
  as `undefined`; they now route to the object node renderer correctly.

## [1.0.2] - 2026-04-10

### Fixed

- Graph now lands correctly centered on initial load and on every Fit click.
- Graph re-centers when the host container is resized.
- Edge labels use a sans-serif font regardless of host-page CSS.

### Added

- Basic screen-reader affordance on the canvas (`role="img"` +
  `aria-label="JSON data visualization"`).

### Changed

- `json` prop type narrowed from `string | object | unknown[]` to
  `string | object`. Arrays are still accepted — no consumer action required.

## [1.0.1]

Initial published version.
