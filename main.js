
(() => {
// ✅ Config
const YENNAM_PLAYLIST_ID = "PLejqAWAjVfCRQDkOL-kgqRMFAE7vreADd";
const YENNAM_API_KEY = "AIzaSyDiFQhzkFVdYOz4NNcLiOGu--u6Lh2MvjY";

  function $(id){ return document.getElementById(id); }

  function showDebug(msg){
    const box = $("yennamDebug");
    if (!box) return alert(msg);
    box.style.display = "block";
    box.textContent = msg;
  }

  function hideDebug(){
    const box = $("yennamDebug");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function waitForYT(maxMs=10000){
    const start = Date.now();
    while (!(window.YT && window.YT.Player)) {
      if (Date.now() - start > maxMs) throw new Error("YouTube iframe API not loaded");
      await wait(80);
    }
  }

  async function fetchPlaylistIds(){
    let pageToken = "";
    const ids = [];

    while (true) {
      const url =
        "https://www.googleapis.com/youtube/v3/playlistItems" +
        "?part=contentDetails&maxResults=50" +
        "&playlistId=" + encodeURIComponent(PLAYLIST_ID) +
        "&key=" + encodeURIComponent(API_KEY) +
        (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");

      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(()=> "");
        throw new Error("Playlist fetch failed: " + res.status + " " + txt);
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

  function setup(){
    // Elements (after DOM is ready)
    const section = $("yennamReelsSection");
    const feed = $("yennamFeed");
    const status = $("yennamStatus");
    const closeBtn = $("yennamCloseBtn");

    if (!section || !feed || !status || !closeBtn) {
      showDebug("❌ Yennam section elements not found. Check IDs in index.html.");
      return;
    }

    function setStatus(t){ status.textContent = t; }

    function close(){
      section.style.display = "none";
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    closeBtn.addEventListener("click", close);

    // expose open function to button onclick
    window.openYennamReels = async function open(){
      section.style.display = "block";
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      // Force layout before creating players
      await wait(150);

      try{
        hideDebug();

        if (!API_KEY || API_KEY.includes("PASTE_")) {
          showDebug("❌ API KEY not pasted in main.js");
          setStatus("API key missing");
          return;
        }

        setStatus("Checking YouTube API…");
        await waitForYT();
        setStatus("Fetching playlist…");

        const ids = await fetchPlaylistIds();
        if (!ids.length) {
          showDebug("❌ No videos found in playlist.");
          setStatus("No videos found");
          return;
        }

        setStatus(`Loaded ${ids.length} videos. Starting…`);

        // Build ONLY first item first (to confirm playback works)
        feed.innerHTML = "";
        const first = document.createElement("div");
        first.style.cssText = "height:100vh; background:#000; position:relative;";
        const box = document.createElement("div");
        box.id = "yennam_player_test";
        box.style.cssText = "width:100%;height:100%;";
        first.appendChild(box);
        feed.appendChild(first);

        const p = new YT.Player("yennam_player_test", {
          videoId: ids[Math.floor(Math.random()*ids.length)],
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => setStatus("Playing (test)…"),
            onError: (e) => showDebug("❌ Player error: " + e.data)
          }
        });

      } catch(err){
        showDebug("❌ " + (err?.message || err));
        setStatus("Error");
        console.error(err);
      }
    };

    // Confirm script executed
    showDebug("✅ main.js loaded. Tap the Yennam button.");
  }

  // Ensure DOM ready before reading elements
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();

