import { internalPassword, pinMatches, requireConfiguration, sendSession, supabase, validatePin } from "./_native.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireConfiguration()) return res.status(503).json({ error: "RECITY authentication is not configured yet." });
  const { recityId, pin } = req.body || {};
  if (typeof recityId !== "string" || !validatePin(pin)) return res.status(400).json({ error: "Enter your RECITY ID and six-digit PIN." });
  try {
    const profiles = await supabase(`/rest/v1/profiles?select=id,recity_id,display_name,eco_identity&recity_id=eq.${encodeURIComponent(recityId.trim().toUpperCase())}`);
    const profile = profiles[0];
    if (!profile) return res.status(401).json({ error: "RECITY ID or PIN is incorrect." });
    const securities = await supabase(`/rest/v1/profile_security?select=pin_hash,failed_pin_attempts,locked_until,internal_auth_email&profile_id=eq.${profile.id}`);
    const security = securities[0];
    if (!security || (security.locked_until && new Date(security.locked_until) > new Date())) return res.status(429).json({ error: "This account is temporarily locked. Try again later." });
    if (!(await pinMatches(pin, security.pin_hash))) {
      const attempts = Number(security.failed_pin_attempts || 0) + 1;
      const patch = attempts >= 5 ? { failed_pin_attempts: 0, locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : { failed_pin_attempts: attempts };
      await supabase(`/rest/v1/profile_security?profile_id=eq.${profile.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      return res.status(401).json({ error: attempts >= 5 ? "Too many attempts. Account locked for 15 minutes." : "RECITY ID or PIN is incorrect." });
    }
    await supabase(`/rest/v1/profile_security?profile_id=eq.${profile.id}`, { method: "PATCH", body: JSON.stringify({ failed_pin_attempts: 0, locked_until: null }) });
    const session = await supabase("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: security.internal_auth_email, password: internalPassword(profile.id) }) }, false);
    sendSession(res, session);
    return res.status(200).json({ profile: { recityId: profile.recity_id, displayName: profile.display_name, ecoIdentity: profile.eco_identity } });
  } catch (error) { console.error("RECITY login error", error); return res.status(500).json({ error: "Sign-in could not be completed. Please try again." }); }
}
