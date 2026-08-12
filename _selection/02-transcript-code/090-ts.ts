function solveTemplate(
  source: Polygon,
  band: BandSpec,
  template: MagneticTemplate,
): TemplateFit | null {
  for (const sizeMm of band.legalSizesMm) {
    const shape = scaleAboutBoundingBoxCentre(
      source,
      sizeMm,
    );

    const magnets = template.nodes.map(node =>
      evaluateDiscSupport(
        shape,
        node,
        12,
      ),
    );

    if (!magnets.every(result => result.supported)) {
      continue;
    }

    const structure = evaluateStructuralSupport(
      shape,
      template,
    );

    const flap = evaluateLocalFlap(
      shape,
      template,
      magnets,
    );

    return {
      sizeMm,
      scaleFromBandBase:
        sizeMm / band.baseSpanMm,
      magnets,
      structure,
      flap,
      bindingMagnet:
        findMinimumClearance(magnets),
    };
  }

  return null;
}
