# Integration details

## Lazy route loading

`loadMagneticEngine()` memoises a dynamic import of the Logic package. Call it only from the Effects Studio client route so browse/product pages do not pay the engine cost.

## Outline ownership

The adapter accepts a completed contour. It does not upload, segment, trace, smooth or modify the user's cutout.

## Rendering

`ShapeSolutionOverlay` renders a neutral SVG view using the exact final ring and selected centres. Production identity remains in millimetres and cell coordinates, not rendered pixels.

## Persistence

Transport the entire Engine ManufacturingSpec. Validate its schema on load and run server verification before fulfilment.
