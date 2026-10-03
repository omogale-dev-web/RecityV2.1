const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function go(id) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  $$("nav button").forEach((button) => button.classList.toggle("selected", button.dataset.go === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3600);
}

function setItem(card, item) {
  card.querySelector("b").textContent = item.name;
  card.querySelector("small").textContent = `${item.material} · ${item.condition}`;
  const label = item.hazardPercent >= 50 ? `Hazard ${item.hazardPercent}%` : `Reusable ${item.reusablePercent}%`;
  card.querySelector("em").textContent = label;
}

function renderAnalysis(analysis) {
  $("#analysis .decision h2").textContent = "AI assessment";
  $("#analysis .decision p:not(.kicker)").textContent = analysis.summary;
  const primary = analysis.items[0] || { reusablePercent: 0, recyclablePercent: 0, hazardPercent: 0 };
  const scoreValues = [primary.reusablePercent, primary.recyclablePercent, primary.hazardPercent];
  $$("#analysis .scores b").forEach((element, index) => (element.textContent = `${scoreValues[index]}%`));
  const cards = $$("#analysis .item");
  cards.forEach((card, index) => {
    const item = analysis.items[index];
    card.hidden = !item;
    if (item) setItem(card, item);
  });
  $("#analysis .section-head span").textContent = analysis.items.length ? `${analysis.items.length} item${analysis.items.length === 1 ? "" : "s"} found` : "No items found";
}

async function fileToCompressedDataUrl(file) {
  const source = URL.createObjectURL(file);
  const image = new Image();
  image.src = source;
  await image.decode();
  const limit = 1500;
  const scale = Math.min(1, limit / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(source);
  return canvas.toDataURL("image/jpeg", 0.82);
}

$$("[data-go]").forEach((button) => (button.onclick = () => go(button.dataset.go)));

$("#start").onclick = () => {
  const name = $("#citizen-name").value.trim();
  if (!name) return toast("Enter your name to continue");
  const token = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 4);
  const id = `RCY-UDG-${token()}-${token()}`;
  const title = $("#eco-title").value;
  $("#welcome").textContent = title;
  $("#profile-name").textContent = title;
  $("#identity").textContent = id;
  $("#profile-id").textContent = id;
  go("dashboard");
  toast("RECITY ID created");
};

$("#photo").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Choose an image file");
  try {
    go("analysis");
    $("#analysis .decision h2").textContent = "Analysing your photo…";
    $("#analysis .decision p:not(.kicker)").textContent = "Recity is securely identifying the visible waste items.";
    const imageDataUrl = await fileToCompressedDataUrl(file);
    if (imageDataUrl.length > 3_800_000) throw new Error("That photo is too large. Please choose a clearer, smaller image.");
    $("#photo-preview").style.background = `center/cover url(${imageDataUrl})`;
    const response = await fetch("/api/analyze-waste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Waste analysis could not be completed.");
    renderAnalysis(result.analysis);
    toast("Waste analysis complete");
  } catch (error) {
    $("#analysis .decision h2").textContent = "Analysis unavailable";
    $("#analysis .decision p:not(.kicker)").textContent = error.message;
    toast(error.message);
  }
};

$("#get-location").onclick = () => {
  const label = $("#location-label");
  label.textContent = "Finding your location…";
  navigator.geolocation?.getCurrentPosition((position) => {
    label.textContent = `Location attached · ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
    toast("Location attached");
  }, () => { label.textContent = "Location permission not granted"; toast("You can submit without a location"); }) || toast("Location is not available");
};

$("#submit-report").onclick = () => { go("reports"); toast("Report submitted successfully"); };
$("#verify-reuse").onclick = () => { go("impact"); toast("Completion awaits verified proof"); };
