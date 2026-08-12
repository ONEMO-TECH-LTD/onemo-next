function solveBand(
  source: Polygon,
  band: BandSpec,
): BandResult {
  for (const sizeMm of band.sizesMm) {
    const polygon = scaleToManufacturedSize(
      source,
      sizeMm,
    );

    let best:
      | {
          layout: LayoutId;
          magnets: MagnetResult[];
        }
      | undefined;

    for (const layoutId of band.publicLayouts) {
      const layout = LAYOUTS[layoutId];

      const magnets = testLayout(
        polygon,
        layout,
      );

      if (!magnets) {
        continue;
      }

      // publicLayouts is ordered strongest → weakest.
      best = {
        layout: layoutId,
        magnets,
      };

      break;
    }

    if (!best) {
      continue;
    }

    return {
      ok: true,
      fit: buildFitResult(
        polygon,
        band.id,
        sizeMm,
        best.layout,
        best.magnets,
      ),
    };
  }

  return {
    ok: false,
    band: band.id,
    reason: "NO_VALID_LAYOUT",
  };
}
