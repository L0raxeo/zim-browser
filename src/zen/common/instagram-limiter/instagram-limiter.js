let ZenInstagramLimiterService = null;

try {
  ZenInstagramLimiterService = ChromeUtils.importESModule(
    "chrome://browser/content/zen-components/ZenInstagramLimiterService.sys.mjs"
  ).ZenInstagramLimiterService;
} catch (error) {
  ZenInstagramLimiterService = null;
}

function getLimiterActor() {
  return window.windowGlobalChild?.getActor("ZenInstagramLimiter") || null;
}

const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get("target") || "https://www.instagram.com";

const PLEDGE_TEXT =
  "I hereby declare that I am a lazy fuck that decides to waste his time scrolling through Instagram rather than enjoying life to the fullest. Instead of working on Agentic Solutions, Venues, or even getting PAID for doing research, I would rather aimlessly scroll through instagram.com, searching for a quick dopamine fix instead of doing the things that I love doing. When my great-grandchildren look back at my photo albums, there will be no photos, because I spent my time scrolling rather than taking life to its fullest advantage.";

const normalPrompt = document.getElementById("normalPrompt");
const limitReached = document.getElementById("limitReached");
const pledgeScreen = document.getElementById("pledgeScreen");
const countDisplay = document.getElementById("countDisplay");
const pledgeInput = document.getElementById("pledgeInput");
const pledgeText = document.getElementById("pledgeText");
const errorMessage = document.getElementById("errorMessage");

function showNormalPrompt(count) {
  normalPrompt.style.display = "block";
  limitReached.style.display = "none";
  pledgeScreen.style.display = "none";
  countDisplay.textContent = count;
}

function showLimitReached() {
  normalPrompt.style.display = "none";
  limitReached.style.display = "block";
  pledgeScreen.style.display = "none";
}

function showPledgeScreen() {
  normalPrompt.style.display = "none";
  limitReached.style.display = "none";
  pledgeScreen.style.display = "block";
  errorMessage.style.display = "none";
}

async function updateCountView() {
  try {
    const actor = getLimiterActor();
    if (actor) {
      const count = await actor.sendQuery("ZenInstagramLimiter:GetCount");
      if (count <= 0) {
        showLimitReached();
        return;
      }
      showNormalPrompt(count);
      return;
    }
    showLimitReached();
  } catch (error) {
    showLimitReached();
  }
}

void updateCountView();

// Handle "Yes" button - show pledge screen
const yesBtn = document.getElementById("yesBtn");
yesBtn.addEventListener("click", async () => {
  try {
    const actor = getLimiterActor();
    if (actor) {
      const count = await actor.sendQuery("ZenInstagramLimiter:GetCount");
      if (count > 0) {
        showPledgeScreen();
      } else {
        showLimitReached();
      }
      return;
    }
    showLimitReached();
  } catch (error) {
    showLimitReached();
  }
});

// Handle "No" button
const noBtn = document.getElementById("noBtn");
noBtn.addEventListener("click", () => {
  window.location.href = "https://www.google.com";
});

// Handle "Go to Google" button on limit reached screen
const limitNoBtn = document.getElementById("limitNoBtn");
limitNoBtn.addEventListener("click", () => {
  window.location.href = "https://www.google.com";
});

// Handle pledge submission
const submitPledge = document.getElementById("submitPledge");
submitPledge.addEventListener("click", async () => {
  const userInput = pledgeInput.value;

  if (userInput === PLEDGE_TEXT) {
    try {
      const actor = getLimiterActor();
      if (actor) {
        const result = await actor.sendQuery("ZenInstagramLimiter:ApproveAndNavigate", {
          targetUrl,
        });
        if (result?.success) {
          return;
        }
      }
      showLimitReached();
      return;
    } catch (error) {
      // Fall through to limit reached below.
    }
    showLimitReached();
    return;
  }

  errorMessage.style.display = "block";
});

// Handle pledge cancellation
const cancelPledge = document.getElementById("cancelPledge");
cancelPledge.addEventListener("click", () => {
  window.location.href = "https://www.google.com";
});

// Hide error message when user starts typing
pledgeInput.addEventListener("input", () => {
  errorMessage.style.display = "none";
});

// Prevent copy-pasting the pledge
pledgeInput.addEventListener("paste", (event) => {
  event.preventDefault();
});

pledgeInput.addEventListener("copy", (event) => {
  event.preventDefault();
});

pledgeInput.addEventListener("cut", (event) => {
  event.preventDefault();
});

pledgeInput.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// Prevent copying from the pledge text display
pledgeText.addEventListener("copy", (event) => {
  event.preventDefault();
});

pledgeText.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});
