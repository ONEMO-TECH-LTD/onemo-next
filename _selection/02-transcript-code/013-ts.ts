function squaredDistancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;

  const wx = px - ax;
  const wy = py - ay;

  const len2 = vx * vx + vy * vy;

  if (len2 === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }

  let t = (wx * vx + wy * vy) / len2;

  if (t <= 0) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }

  if (t >= 1) {
    const dx = px - bx;
    const dy = py - by;
    return dx * dx + dy * dy;
  }

  const qx = ax + t * vx;
  const qy = ay + t * vy;

  const dx = px - qx;
  const dy = py - qy;

  return dx * dx + dy * dy;
}
