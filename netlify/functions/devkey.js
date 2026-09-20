/* ============================================================
   IELTS PRO 150 — Vercel dev-only key bridge
   404 in production (VERCEL_ENV !== 'development') — the live
   site uses the secure /api/openrouter proxy instead.
   ============================================================ */

export default async function handler(_, res) {
  if (process.env.VERCEL_ENV !== 'development') return res.status(404).end();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(404).end();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ key });
}
