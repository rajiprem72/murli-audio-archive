// ✅ Config
const YENNAM_PLAYLIST_ID = "PLejqAWAjVfCRQDkOL-kgqRMFAE7vreADd";
const YENNAM_API_KEY = "AIzaSyDiFQhzkFVdYOz4NNcLiOGu--u6Lh2MvjY";

// ✅ Elements
const ySection = document.getElementById("yennamReelsSection");
const yFeed = document.getElementById("yennamFeed");
const yStatus = document.getElementById("yennamStatus");
const yCloseBtn = document.getElementById("yennamCloseBtn");

let yVideoIds = [];
let yOrder = [];
let yPos = 0;
let yPlayers = [];
let yObserver = null;
let yBuilt = false;

function ySetStatus(msg){ yStatus.textContent = msg; }

// ---------- Random helpers ----------
function shuffleInPlace(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildNewRandomOrder(){
  yOrder = shuffleInPlace([...Array(yVideoIds.length).keys()]);
  yPos = 0;
}

function currentIndex(){
  return yOrder[yPos] ?? 0;
}

function nextIndex(){
  yPos++;
  if (yPos >= yOrder.length) buildNewRandomOrder(); // reshuffle after one full cycle
  return currentIndex();
}

// Open / close
function openYennamReels(){
  ySection.style.display = "block";
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  if (!yBuilt) {
    yBuilt = true;
    setTimeout(() => yInitYennam(), 150);  // ✅ wait for layout
  } else {
    buildNewRandomOrder();
    yScrollToIndex(currentIndex(), false);
    yPlayIndex(currentIndex());
  }
}
window.openYennamReels = openYennamReels;

function closeYennamReels(){
  yPlayers.forEach(p => { try { p.pauseVideo(); } catch(e){} });
  ySection.style.display = "none";
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
yCloseBtn.addEventListener("click", closeYennamReels);

// Fetch playlist videos
async function yFetchPlaylistVideoIds(){
  let pageToken = "";
  const ids = [];

  while (true) {
    const url =
      "https://www.googleapis.com/youtube/v3/playlistItems" +
      "?part=contentDetails" +
      "&maxResults=50" +
      "&playlistId=" + encodeURIComponent(YENNAM_PLAYLIST_ID) +
      "&key=" + encodeURIComponent(YENNAM_API_KEY) +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");

    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(()=> "");
      throw new Error("YouTube API error: " + res.status + " " + txt);
    }
    const data = await res.json();
    (data.items || []).forEach(it => {
      const vid = it?.contentDetails?.videoId;
      if (vid) ids.push(vid);
    });

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

// Build feed
function yBuildFeed(ids){
  yFeed.innerHTML = "";
  yPlayers = [];

  ids.forEach((id, i) => {
    const item = document.createElement("div");
    item.style.cssText = "height:100vh;scroll-snap-align:start;position:relative;";
    item.dataset.index = String(i);

    const box = document.createElement("div");
    box.id = "yennam_player_" + i;
    box.style.cssText = "width:100%;height:100%;";

    const spinner = document.createElement("div");
    spinner.textContent = "Loading…";
    spinner.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
      "color:#fff;font:14px system-ui;opacity:.85;";

    item.appendChild(box);
    item.appendChild(spinner);
    yFeed.appendChild(item);
  });
}

// Wait for YouTube iframe API
function yWaitForYT(){
  return new Promise(resolve => {
    const t = setInterval(() => {
      if (window.YT && window.YT.Player) { clearInterval(t); resolve(); }
    }, 60);
  });
}

// Create players
function yCreatePlayers(){
  const items = [...yFeed.children];

  yVideoIds.forEach((id, i) => {
    yPlayers[i] = new YT.Player("yennam_player_" + i, {
      videoId: id,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          const sp = items[i]?.querySelector("div:nth-child(2)");
          if (sp) sp.style.display = "none";
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) yGoNextRandom();
        }
      }
    });
  });
}

// Scroll + play
function yScrollToIndex(idx, smooth=true){
  const el = yFeed.children[idx];
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
}

function yPlayIndex(idx){
  yPlayers.forEach((p, j) => { if (j !== idx) { try { p.pauseVideo(); } catch(e){} }});
  try { yPlayers[idx]?.playVideo(); } catch(e){}
  ySetStatus(`Random ${yPos + 1} / ${yOrder.length}`);
}

function yGoNextRandom(){
  const idx = nextIndex();
  yScrollToIndex(idx, true);
  setTimeout(() => yPlayIndex(idx), 450);
}

// Observer (user swipe support)
function ySetupObserver(){
  if (yObserver) { try { yObserver.disconnect(); } catch(e){} }

  yObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const visibleIdx = Number(en.target.dataset.index);
      const foundPos = yOrder.indexOf(visibleIdx);
      if (foundPos >= 0) yPos = foundPos;
      yPlayIndex(visibleIdx);
    });
  }, { threshold: 0.70 });

  [...yFeed.children].forEach(el => yObserver.observe(el));
}

// Init
async function yInitYennam(){
  try{
    yHideErr();

    if (!YENNAM_API_KEY || YENNAM_API_KEY.includes("PASTE_")) {
      ySetStatus("API key missing");
      yShowErr("Please paste your YouTube API key in main.js (YENNAM_API_KEY).");
      return;
    }
    ...
  } catch(err){
    console.error(err);
    ySetStatus("Error");
    yShowErr("Error: " + (err?.message || err));
  }
}



const yErr = document.getElementById("yennamError");
function yShowErr(msg){
  if (!yErr) return;
  yErr.style.display = "block";
  yErr.textContent = msg;
}
function yHideErr(){
  if (!yErr) return;
  yErr.style.display = "none";
  yErr.textContent = "";
}


