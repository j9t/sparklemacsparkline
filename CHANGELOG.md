# Changelog

All notable changes to Sparkle MacSparkline are documented in this file, which is (mostly) AI-generated and (always) human-edited. Dependency updates may or may not be called out specifically.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-11-20

### Fixed

* Ensured valid output for series spanning nearly the full range of numbers
* Rejected titles and labels with characters XML doesn’t allow, non-string titles, and sizes too small to fit the line or too large to compute
* Prevented slow description generation for titles ending in long runs of whitespace (CodeQL `js/polynomial-redos`)
* Left out the lead of the description for titles consisting only of periods and whitespace

### Changed

* Sped up long series and shortened their output by drawing only the points that shape the line where several share an x coordinate
* Made path data generation faster

## [1.0.1] - 2026-11-19

### Changed

* Made the output as short as valid SVG allows while rendering identically

## [1.0.0] - 2026-11-19

### Added

* Released initial version