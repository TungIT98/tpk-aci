# Hailuo I2V Camera Movement Guide

## Camera Movements (I2V&T2V-01-DIRECTOR Model)

### Basic Movements

| Movement | Syntax | Description |
|----------|--------|-------------|
| Push in | `[Push in]` | Camera moves forward toward subject |
| Pull out | `[Pull out]` | Camera moves backward from subject |
| Pan left | `[Pan left]` | Camera stationary, angle pans left |
| Pan right | `[Pan right]` | Camera stationary, angle pans right |
| Tilt up | `[Tilt up]` | Camera stationary, angle tilts upward |
| Tilt down | `[Tilt down]` | Camera stationary, angle tilts downward |
| Truck left | `[Truck left]` | Camera tracks left |
| Truck right | `[Truck right]` | Camera tracks right |
| Pedestal up | `[Pedestal up]` | Camera rises vertically |
| Pedestal down | `[Pedestal down]` | Camera lowers vertically |
| Zoom in | `[Zoom in]` | Lens zooms in |
| Zoom out | `[Zoom out]` | Lens zooms out |
| Tracking shot | `[Tracking shot]` | Camera follows subject |
| Static | `[Static]` | No camera movement |
| Shake | `[Shake]` | Camera shake effect |

### Cinematic Combinations

| Effect | Syntax | Use Case |
|--------|---------|----------|
| Reveal | `[Pan left, Pedestal up]` | Start wide, reveal subject |
| Dolly zoom | `[Push in, Zoom out]` | Horror/drama effect |
| Circling | `[Truck left, Pan right, Tracking shot]` | Orbit around subject |
| Walking | `[Truck left, Tracking shot]` | Follow walking person |
| Rising | `[Push in, Pedestal up]` | Dramatic reveal from ground |
| Pull back | `[Pull out, Pedestal down]` | Epic scope shot |

## Prompt Format

### ✅ CORRECT Format:
```
[Push in]A lamb stands in the snow.
```

### ❌ WRONG Format:
```
Realistic style [tracking shot], warm tones, a lamb stands in the snow.
```

## Rules

1. **Insert camera at action point** - Where the movement happens
2. **Use brackets** - `[Push in]` not "push in"
3. **Multiple movements** - `[Pan left, Tilt up]` for combined effects
4. **Sequential movements** - `[Pan left]` then `[Truck right]` for sequential shots

## Example Prompts

### Example 1: Static with emotional close-up
```
[Static]Beautiful woman stands at cliff edge.
[Tracking shot]Wind blows through her hair.
[Push in on emotional expression]Tears form in her eyes.
```

### Example 2: Walking sequence
```
[Pan left]Woman begins walking down the street.
[Truck left, Tracking shot]Camera follows her movement.
```

### Example 3: Dramatic reveal
```
[Pedestal up, Pan left]Camera rises from ground, revealing city skyline.
```

### Example 4: Dolly zoom (Hitchcock effect)
```
[Push in, Zoom out]Subject approaches while background shrinks.
```
