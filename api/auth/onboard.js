import crypto from "node:crypto";
import { hashPin, internalPassword, randomRecoveryCode, requireConfiguration, sendSession, supabase, validatePin } from "./_native.js";

function recityId() {
  const token = () => crypto.randomBytes(3).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  return `RCY-UDG-${token()}-${token()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireConfiguration()) return res.status(503).json({ error: "RECITY authentication is not configured yet." });
  const { name, ecoIdentity, pin } = req.body || {};
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters." });
  if (!validatePin(pin)) return res.status(400).json({ error: "PIN must contain exactly six digits." });
  if (!["Seedling", "Eco Explorer", "Green Guardian", "City Shaper"].includes(ecoIdentity)) return res.status(400).json({ error: "Choose a valid eco identity." });
  try {
    const generatedUserId = crypto.randomUUID();
    const email = `recity-${generatedUserId}@auth.recity.invalid`;
    const user = await supabase("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ id: generatedUserId, email, password: internalPassword(generatedUserId), email_confirm: true }) });
    const userId = user.id || user.user?.id || generatedUserId;
    const profile = { id: userId, recity_id: recityId(), display_name: name.trim(), eco_identity: ecoIdentity };
    await supabase("/rest/v1/profiles", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(profile) });
    const recoveryCode = randomRecoveryCode();
    await supabase("/rest/v1/profile_security", { method: "POST", body: JSON.stringify({ profile_id: userId, pin_hash: await hashPin(pin), internal_auth_email: email }) });
    await supabase("/rest/v1/user_roles", { method: "POST", body: JSON.stringify({ user_id: userId, role: "citizen" }) });
    await supabase("/rest/v1/auth_recovery_codes", { method: "POST", body: JSON.stringify({ profile_id: userId, code_hash: await hashPin(recoveryCode) }) });
    const session = await supabase("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password: internalPassword(userId) }) }, false);
    sendSession(res, session);
    return res.status(201).json({ profile: { recityId: profile.recity_id, displayName: profile.display_name, ecoIdentity: profile.eco_identity }, recoveryCode });
  } catch (error) {
    console.error("RECITY onboarding error", error);
    return res.status(500).json({ error: "Account could not be created. Please try again." });
  }
}
