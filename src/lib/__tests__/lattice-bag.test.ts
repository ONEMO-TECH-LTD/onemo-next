import { describe, expect, it } from 'vitest'
import {
  DISK_DIAMETER_MM,
  fitBagCount,
  fitBagOptions,
  LATTICE_PITCH_MM,
  MAX_BAG_DISKS,
  normalizeBagOutline,
  prepareBag,
} from '../lattice-bag'
import { pointInPolygon } from '../effect/polygon'

const irregular = normalizeBagOutline([
  [-60, -40], [10, -52], [58, -28], [34, 4], [72, 38],
  [8, 50], [-20, 30], [-68, 44], [-42, 4],
])

describe('lattice bag prototype', () => {
  const prepared = prepareBag(irregular)

  it('moves every disk through one rigid lattice transform', () => {
    const fit = fitBagCount(prepared, 40)
    const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])
    expect(distance(fit.seats[0], fit.seats[1])).toBeCloseTo(LATTICE_PITCH_MM, 8)
    expect(distance(fit.seats[0], fit.seats[2])).toBeCloseTo(LATTICE_PITCH_MM, 8)
    expect(distance(fit.seats[1], fit.seats[2])).toBeCloseTo(LATTICE_PITCH_MM * 2, 8)
  })

  it('keeps vertical and horizontal options straight unless rotation is enabled', () => {
    const fixed = fitBagOptions(prepared, 2)
    expect(fixed.map((option) => option.rotation)).toEqual([0, 0, 0, 0])
    expect(fixed[0].seats[0][0]).toBeCloseTo(fixed[0].seats[1][0], 8)
    expect(fixed[1].seats[0][1]).toBeCloseTo(fixed[1].seats[1][1], 8)

    const rotating = fitBagOptions(prepared, 2, true)
    expect(rotating.some((option) => Math.abs(option.rotation) > 1e-6)).toBe(true)
  })

  it('add/remove re-settles deterministically without deforming the lattice', () => {
    const nine = fitBagCount(prepared, 9)
    const ten = fitBagCount(prepared, 10)
    const back = fitBagCount(prepared, 9)

    expect(ten.seats).toHaveLength(10)
    expect(back.seats).toEqual(nine.seats)
    expect(back.outline).toEqual(nine.outline)
  })

  it('contracts the linked outline onto the current disk group', () => {
    const fit = fitBagCount(prepared, 24)
    expect(fit.seats.every((seat) => pointInPolygon(seat, fit.outline))).toBe(true)
    expect(Math.min(...fit.contacts.map((contact) => Math.abs(contact.clearanceMM)))).toBeLessThan(0.2)
    expect(fit.contacts.length).toBeLessThanOrEqual(fit.seats.length)
    expect(DISK_DIAMETER_MM).toBe(24)
  })

  it('keeps the uploaded outline rigid and changes only its uniform scale', () => {
    const fit = fitBagCount(prepared, 2)
    const ratios = fit.outline.map(([x, y], index) => {
      const [sx, sy] = prepared.outline[index]
      return Math.hypot(x, y) / Math.hypot(sx, sy)
    }).filter(Number.isFinite)
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(1e-8)
    expect(MAX_BAG_DISKS).toBe(1000)
  })
})
