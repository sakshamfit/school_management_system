/**
 * Minimal semver compare for x.y.z versions (release feed ordering).
 * Returns >0 if a>b, <0 if a<b, 0 when equal. Non-semver inputs compare equal.
 */
export default function semverCompare(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10));
  const pb = String(b).split('.').map(n => parseInt(n, 10));
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return 0;
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}
