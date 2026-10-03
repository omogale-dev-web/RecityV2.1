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

const marathi = {"WELCOME TO RECITY":"RECITY मध्ये आपले स्वागत आहे","Your actions can":"तुमच्या कृतींनी","reshape the city.":"शहर बदलू शकते.","A secure local identity for people who care for their neighbourhood.":"आपल्या परिसराची काळजी घेणाऱ्या नागरिकांसाठी सुरक्षित ओळख.","Citizen identity":"नागरिक ओळख","Security PIN":"सुरक्षा PIN",Recovery:"पुनर्प्राप्ती","Your name":"तुमचे नाव","Choose your eco identity":"तुमची पर्यावरण ओळख निवडा",Seedling:"रोप","Eco Explorer":"पर्यावरण शोधक","Green Guardian":"हरित रक्षक","City Shaper":"शहर घडवणारा","Create my RECITY ID":"माझी RECITY ओळख तयार करा","No email or phone number needed. You control your identity.":"ईमेल किंवा फोन नंबरची गरज नाही. तुमची ओळख तुमच्या नियंत्रणात आहे.","GOOD MORNING":"शुभ प्रभात","WASTE INTELLIGENCE":"कचरा बुद्धिमत्ता","What can this become?":"याचे पुढे काय होऊ शकते?","Scan waste":"कचरा स्कॅन करा","Verified points":"सत्यापित गुण","Waste diverted":"कचरा वाचवला","Actions verified":"सत्यापित कृती","Active reports":"सक्रिय अहवाल","See all":"सर्व पहा","No reports yet":"अजून अहवाल नाहीत","Your submitted reports will appear here.":"तुमचे अहवाल येथे दिसतील.","Back":"मागे","NEW WASTE CHECK":"नवीन कचरा तपासणी","Take a clear photo":"स्पष्ट फोटो काढा","Take or upload a photo":"फोटो काढा किंवा अपलोड करा","Privacy first":"गोपनीयता प्रथम","ANALYSIS RESULT":"तपासणी निकाल","Waste check":"कचरा तपासणी","AI assessment":"AI मूल्यांकन","Detected items":"ओळखलेल्या वस्तू","Awaiting scan":"स्कॅनची प्रतीक्षा","Explore reuse guide":"पुनर्वापर मार्गदर्शक पहा","Report for collection":"संकलनासाठी अहवाल द्या","VERIFIED REUSE GUIDE":"सत्यापित पुनर्वापर मार्गदर्शक","Bottle herb planter":"बाटलीतील रोपकुंडी","What you need":"तुम्हाला काय लागेल",Steps:"पायऱ्या","Mark as completed":"पूर्ण झाले म्हणून नोंदवा","CIVIC REPORT":"नागरी अहवाल","Report this waste":"या कचऱ्याचा अहवाल द्या","Report title":"अहवालाचे शीर्षक",Notes:"नोंदी","Location not attached":"स्थान जोडलेले नाही","Use my location":"माझे स्थान वापरा","Submit report":"अहवाल पाठवा","YOUR REPORTS":"तुमचे अहवाल","Report history":"अहवाल इतिहास","VERIFIED IMPACT":"सत्यापित परिणाम","Grow with your city.":"तुमच्या शहरासोबत वाढा.",Home:"मुख्यपृष्ठ",Reports:"अहवाल",Scan:"स्कॅन",Impact:"परिणाम",Profile:"प्रोफाइल","RECITY IDENTITY":"RECITY ओळख","Profile & security":"प्रोफाइल आणि सुरक्षा","Account security":"खाते सुरक्षा"};
function applyLanguage(language){const mr=language==="mr";document.documentElement.lang=mr?"mr":"en";const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const text=node.nodeValue.trim();if(mr&&marathi[text])node.nodeValue=node.nodeValue.replace(text,marathi[text])});$("#citizen-name").placeholder=mr?"तुमचे नाव लिहा":"Enter your name";$("#language-toggle").textContent=mr?"English":"मराठी"}
const activeLanguage=localStorage.getItem("recity-language")||"en";applyLanguage(activeLanguage);$("#language-toggle").onclick=()=>{localStorage.setItem("recity-language",activeLanguage==="mr"?"en":"mr");window.location.reload()};
