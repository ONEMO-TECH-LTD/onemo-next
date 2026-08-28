import { RELEASED_PADDING_MM } from '../grid-magnet-spec'
import { offsetPathMM } from '../offset'
import type { OutlineRecipe } from './class-contract'
import { convexHull, rotateAround } from './geometry'
import type { PointMM } from './types'

export function outlineFromLayout(nodesMM: readonly PointMM[], recipe: OutlineRecipe): PointMM[] {
  const path = convexHull(nodesMM)
  if (!path.length) throw new Error('library: empty population has no outline')
  const end = path.length >= 3 ? 'polygon' : recipe.corners === 'round' ? 'round' : 'square'
  const raw = offsetPathMM(path.map(([x, y]) => [x, y]), RELEASED_PADDING_MM, recipe.corners, end)
  if (!raw) throw new Error('library: population has no outline')
  return path.length === 1 && recipe.pointRotationDeg ? rotateAround(raw, path[0], recipe.pointRotationDeg) : raw
}
