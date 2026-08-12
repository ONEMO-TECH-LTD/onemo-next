function survivesSparsePhase(
  ix: number,
  iy: number,
  phaseX: 0 | 1,
  phaseY: 0 | 1,
): boolean {
  return (
    mod(ix, 2) === phaseX &&
    mod(iy, 2) === phaseY
  );
}
