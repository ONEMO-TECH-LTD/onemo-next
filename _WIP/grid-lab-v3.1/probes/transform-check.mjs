// Does the kernel transform, fed as planned, reproduce the SHELL's own drawing expression exactly?
// Shell (page.tsx:215-218 + 508): k = sizeMM/max(W,H); box.w = W*k; box.x = -box.w/2
//                                 mm_x = box.x + (px/W)*box.w
// Kernel (CONTRACT §2):           T(p) = targetAnchor + (s/S)(p - sourceAnchor)
// Proposed: encode ring x2 -> integers; S = 2*max(W,H); sourceAnchor = (W,H); targetAnchor = (0,0); s = sizeMM
const W = 743, H = 512, sizeMM = 120;               // odd numbers on purpose
const k = sizeMM / Math.max(W, H);
const boxW = W * k, boxX = -boxW / 2;
const shell   = (px) => boxX + (px / W) * boxW;
const kernel  = (px) => 0 + (sizeMM / (2 * Math.max(W, H))) * (2 * px - W);
let worst = 0;
for (const px of [-0.5, 0, 1.5, 100.5, 371.5, 742.5, W]) {
  worst = Math.max(worst, Math.abs(shell(px) - kernel(px)));
}
console.log('max |shell - kernel| over sample px:', worst);
console.log('half-pixel coords become integers under x2:', [0.5, 1.5, -0.5].map(v => v * 2).every(Number.isInteger));
console.log('sourceSize integer:', Number.isInteger(2 * Math.max(W, H)), '=', 2 * Math.max(W, H));
console.log('sourceAnchor integers:', Number.isInteger(W) && Number.isInteger(H), '=', [W, H]);
