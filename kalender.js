
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const loginPanel = document.getElementById("login");
const loginForm = document.getElementById("login-form");
const passwordField = document.getElementById("password");
const unlockButton = document.getElementById("unlock");
const loginStatus = document.getElementById("login-status");
const calendar = document.getElementById("calendar");
let activeKey = null;
let photoUrl = null;

async function downloadEncrypted(path) {
  const response = await fetch("./" + path);
  if (!response.ok) throw new Error("Datei fehlt");
  return new Uint8Array(await response.arrayBuffer());
}

function decrypt(key, path, bytes) {
  return crypto.subtle.decrypt({
    name: "AES-GCM",
    iv: bytes.subarray(0, 12),
    additionalData: encoder.encode(path),
  }, key, bytes.subarray(12));
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (unlockButton.disabled) return;
  unlockButton.disabled = true;
  loginStatus.textContent = "Kalender wird geöffnet …";

  const password = passwordField.value.trim();
  passwordField.value = "";

  try {
    const path = "inhalt.bin";
    const encrypted = await downloadEncrypted(path);
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
    let content;
    try {
      content = JSON.parse(decoder.decode(await decrypt(key, path, encrypted)));
    } catch {
      loginStatus.textContent = "Das Passwort passt nicht. Kopiere es noch einmal vollständig.";
      return;
    }

    document.title = content.title;
    document.getElementById("intro-1").textContent = content.intro[0];
    document.getElementById("intro-2").textContent = content.intro[1];
    document.getElementById("dedication").textContent = content.footer;
    activeKey = key;
    loginStatus.textContent = "";
    loginPanel.hidden = true;
    calendar.hidden = false;
    refresh();
    document.getElementById("calendar-title").focus();
  } catch {
    loginStatus.textContent = "Der Kalender konnte nicht geladen werden. Prüfe den Link und versuche es erneut.";
  } finally {
    unlockButton.disabled = false;
    if (!activeKey) passwordField.focus();
  }
});

document.getElementById("lock-calendar").addEventListener("click", () => {
  activeKey = null;
  if (dialog.open) dialog.close();
  clearPhoto();
  calendar.hidden = true;
  loginPanel.hidden = false;
  document.title = "Adventskalender";
  for (const id of ["intro-1", "intro-2", "dedication"]) {
    document.getElementById(id).textContent = "";
  }
  passwordField.focus();
});

function clearPhoto() {
  photoRequest++;
  photo.hidden = true;
  photo.removeAttribute("src");
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
}

if (window.isSecureContext && window.crypto?.subtle) {
  unlockButton.disabled = false;
} else {
  loginStatus.textContent = "Bitte öffne den Kalender über seinen sicheren GitHub-Pages-Link.";
}

const calendarYear = 2026;
const doorCount = 24;
const doors = document.getElementById("doors");
const statusLabel = document.getElementById("status");
const dialog = document.getElementById("surprise");
const photo = document.getElementById("photo");
const photoStatus = document.getElementById("photo-status");

let activeDay = null;
let renderedState = "";
let photoRequest = 0;

function unlockedCount(now) {
  if (now < new Date(calendarYear, 11, 1)) return 0;
  if (now >= new Date(calendarYear, 11, doorCount)) return doorCount;
  return now.getDate();
}

function canOpen(day, now = new Date()) {
  return activeKey !== null && day <= unlockedCount(now);
}

async function showDoor(day) {
  if (!canOpen(day)) {
    refresh();
    return;
  }

  activeDay = day;
  clearPhoto();
  const request = photoRequest;
  const key = activeKey;
  document.getElementById("day-title").textContent = day + ". Dezember";
  photoStatus.textContent = "Das Foto lädt …";
  photoStatus.hidden = false;
  dialog.showModal();

  try {
    const path = "bilder/" + String(day).padStart(2, "0") + ".bin";
    const encrypted = await downloadEncrypted(path);
    const data = await decrypt(key, path, encrypted);
    if (request !== photoRequest || !dialog.open) return;
    photoUrl = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
    photo.alt = "Foto für den " + day + ". Dezember";
    photo.src = photoUrl;
    photo.hidden = false;
    photoStatus.hidden = true;
  } catch {
    if (request !== photoRequest || !dialog.open) return;
    photoStatus.textContent = "Das Foto konnte nicht geladen werden. Schließe das Türchen und versuche es erneut.";
  }
}

const doorButtons = Array.from({ length: doorCount }, (_, index) => {
  const day = index + 1;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "door";
  const number = document.createElement("span");
  number.className = "number";
  number.textContent = day;
  const mark = document.createElement("span");
  mark.setAttribute("aria-hidden", "true");
  button.append(number, mark);
  button.addEventListener("click", () => showDoor(day));
  doors.append(button);
  return { day, button, mark };
});

function refresh() {
  const now = new Date();
  const unlocked = unlockedCount(now);
  const today = now.getFullYear() === calendarYear && now.getMonth() === 11
    ? now.getDate()
    : 0;

  if (dialog.open && !canOpen(activeDay, now)) dialog.close();

  const state = [unlocked, today].join("/");
  if (state === renderedState) return;
  renderedState = state;

  statusLabel.textContent = unlocked === 0
      ? "Start am 1. Dezember " + calendarYear
      : unlocked + " von " + doorCount + " verfügbar";

  for (const { day, button, mark } of doorButtons) {
    const available = day <= unlocked;
    button.disabled = !available;
    button.classList.toggle("today", day === today);
    button.setAttribute("aria-label", day + ". Dezember, " + (available ? "verfügbar" : "verschlossen"));
    if (day === today) button.setAttribute("aria-current", "date");
    else button.removeAttribute("aria-current");
    mark.className = available ? "mark" : "lock";
    mark.textContent = available ? "♥" : "";
  }
}

dialog.addEventListener("close", () => {
  activeDay = null;
  clearPhoto();
});

refresh();
setInterval(refresh, 1000);
window.addEventListener("pageshow", refresh);
document.addEventListener("visibilitychange", refresh);
