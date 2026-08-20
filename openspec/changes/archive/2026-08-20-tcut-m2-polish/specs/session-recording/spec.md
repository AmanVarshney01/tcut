## ADDED Requirements

### Requirement: Quantized timestamps
When `quantize` is true the recorder SHALL round every event timestamp up to the next `1/fps` boundary before writing the cast.

#### Scenario: quantized cast
- **WHEN** `quantize: true` and `fps: 60`
- **THEN** every event time × 60 is an integer (within floating-point tolerance)

### Requirement: Core selection for the screen model
The recorder's headless screen model SHALL use Ghostty by default and wterm's lite core when `core: "lite"`.

#### Scenario: lite recording
- **WHEN** `core: "lite"` is configured
- **THEN** `run()`, `wait()` and `expect()` still operate on the rendered screen
