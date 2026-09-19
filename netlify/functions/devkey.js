/* ============================================================
   IELTS PRO 150 — Netlify Function: dev-only key bridge
   ------------------------------------------------------------
   LOCAL DEVELOPMENT ONLY. Hands the OpenRouter key to the
   browser so long AI generation calls can bypass the local
   function emulator's 30-second cap by calling OpenRouter
   directly.

   Security:
   • In local dev, netlify-cli injects CONTEXT=dev (and
     NETLIFY_DEV=1). This handler refuses everything else.
   • In production, CONTEXT is "production" / "deploy-preview" /
     "branch-deploy" — this endpoint answers 404 and the app
     keeps using the secure /api/openrouter proxy, so the key
     is never exposed on your deployed site.
   ============================================================ */

exports.handler = async () => {
  const isLocalDev =
    process.env.CONTEXT === 'dev' ||
    process.env.NETLIFY_DEV === '1';

  if (!isLocalDev) {
    return { statusCode: 404, body: 'Not found' };
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { statusCode: 404, body: 'Not found' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({ key })
  };
};