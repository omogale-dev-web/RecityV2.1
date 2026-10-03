const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function cleanPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function normalizeAnalysis(value) {
  const items = Array.isArray(value.items) ? value.items.slice(0, 6) : [];
  return {
    summary: String(value.summary || "No waste items could be identified clearly."),
    safetyNote: String(value.safety_note || "Handle unknown waste carefully."),
    items: items.map((item) => ({
      name: String(item.name || "Unidentified item"), material: String(item.material || "Unknown material"), condition: String(item.condition || "Unknown condition"),
      reusablePercent: cleanPercent(item.reusable_percent), recyclablePercent: cleanPercent(item.recyclable_percent), compostablePercent: cleanPercent(item.compostable_percent), hazardPercent: cleanPercent(item.hazard_percent), confidence: cleanPercent(item.confidence),
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "Waste analysis is not configured yet." });
  const { imageDataUrl } = req.body || {};
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) return res.status(400).json({ error: "Please provide a valid image." });
  try {
    const response = await fetch(GROQ_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "qwen/qwen3.8-27b", temperature: 0, max_completion_tokens: 900, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You identify household and civic waste from photos. Return JSON only. Do not choose a final Recity action; a separate verified rules engine will do that." }, { role: "user", content: [{ type: "text", text: "Analyse this waste photo. Return exactly {summary, safety_note, items:[{name, material, condition, reusable_percent, recyclable_percent, compostable_percent, hazard_percent, confidence}]}. Percentages are 0 to 100. Be conservative about hazard and confidence." }, { type: "image_url", image_url: { url: imageDataUrl } }] }] }) });
    if (!response.ok) { console.error("Groq vision error", response.status, await response.text()); return res.status(502).json({ error: "Waste analysis could not be completed. Try another photo." }); }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned no analysis");
    return res.status(200).json({ analysis: normalizeAnalysis(JSON.parse(content)) });
  } catch (error) { console.error("Waste analysis error", error); return res.status(502).json({ error: "Waste analysis could not be completed. Try another photo." }); }
}
