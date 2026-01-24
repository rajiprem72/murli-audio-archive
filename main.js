(() => {
  // =========================
  // CONFIG (edit only these)
  // =========================
  const YENNAM_PLAYLIST_ID = "PLejqAWAjVfCRQDkOL-kgqRMFAE7vreADd";
  const YENNAM_API_KEY = "PASTE_YOUR_API_KEY_HERE"; // <-- paste real key inside quotes

  // =========================
  // Helpers
  // =========================
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function setStatus(msg) {
    const el = $("yennamStatus");
    if (el) el.textContent = msg;
  }

  function showDebug(msg) {
    const box = $("yennamDebug");
    if (!box) {
      console.log(msg);
      return;
    }
    box.style.display = "block";
    box.textContent = msg;
  }

  function hideDebug() {
    const box = $("yennamDebug");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  async function waitForYT(maxMs = 12000) {
    const start = Date.now();
    while (!(window.YT && window.YT.Player)) {
      if (Date.now() - start > maxMs) throw new Error("YouTube iframe API not loaded");
      await wait(80);
    }
  }

  // =========================
  // Background music control
  // =========================
  let yWasMusicPlaying = false;

  function pauseBgMusicForYennam() {
    const a = $("bgMusic");
    if (!a) return;
    yWasMusicPlaying = !a.paused;
    a.pause();

    // lock auto-start in your music script
    window.YENNAM_MUSIC_LOCK = true;
    if (window.updateMusicToggleUI) window.updateMusicToggleUI();
  }

  function restoreBgMusicAfterYennam() {
    const a = $("bgMusic");
    if (!a) return;

    window.YENNAM_MUSIC_LOCK = false;
    if (yWasMusicPlaying) a.play().catch(() => {});
    if (window.updateMusicToggleUI) window.updateMusicToggleUI();
  }

  // =========================
  // Fetch playlist IDs
  // =========================
  async function fetchPlaylistVideoIds() {
    let pageToken = "";
    const ids = [];

    while (true) {
      const url =
        "https://www.googleapis.com/youtube/v3/playlistItems" +
        "?part=contentDetails&maxResults=50" +
        "&playlistId=" + encodeURIComponent(YENNAM_PLAYLIST_ID) +
        "&key=" + encodeURIComponent(YENNAM_API_KEY) +
        (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");

      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error("Playlist fetch failed: " + res.status + " " + txt);
      }

      const data = await res.json();
      (data.items || []).forEach((it) => {
        const vid = it?.contentDetails?.videoId;
        if (vid) ids.push(vid);
      });

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    return ids;
  }

  // =========================
  // Random queue (no repeats)
  // =========================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // =========================
  // Yennam player state
  // =========================
  let ySection, yFeed, yCloseBtn;
  let yPlayer = null;
  let yVideoIds = [];
  let yOrder = [];
  let yPos = 0;
  let yLoadedOnce = false;

  function currentVideoId() {
    return yOrder[yPos];
  }

  function nextVideoId() {
    yPos++;
    if (yPos >= yOrder.length) {
      // reshuffle after one full cycle
      yOrder = shuffle([...yVideoIds]);
      yPos = 0;
    }
    return yOrder[yPos];
  }

  function buildFullscreenPlayerContainer() {
    // Ensure overlay looks full-screen
    ySection.style.display = "block";
    ySection.style.position = "fixed";
    ySection.style.inset = "0";
    ySection.style.width = "100vw";
    ySection.style.height = "100vh";
    ySection.style.background = "#000";
    ySection.style.zIndex = "999999";

    yFeed.style.position = "absolute";
    yFeed.style.inset = "0";
    yFeed.style.height = "100vh";
    yFeed.style.background = "#000";
    yFeed.style.overflow = "hidden"; // single player, no scroll needed

    yFeed.innerHTML = `
      <div style="height:100vh;background:#000;">
        <div id="yennam_player" style="width:100%;height:100%;"></div>
      </div>
    `;
  }

  function closeYennam() {
    try {
      if (yPlayer && yPlayer.pauseVideo) yPlayer.pauseVideo();
    } catch (e) {}

    ySection.style.display = "none";
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";

    restoreBgMusicAfterYennam();
  }

  async function openYennam() {
    hideDebug();

    if (!YENNAM_API_KEY || YENNAM_API_KEY.includes("PASTE_")) {
      showDebug("❌ Please paste your YouTube API key in main.js (YENNAM_API_KEY).");
      setStatus("API key missing");
      return;
    }

    // pause bg music
    pauseBgMusicForYennam();

    // lock page behind
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // show overlay
    ySection.style.display = "block";
    await wait(120); // allow layout

    try {
      setStatus("Loading YouTube…");
      await waitForYT();

      if (!yLoadedOnce) {
        setStatus("Fetching playlist…");
        yVideoIds = await fetchPlaylistVideoIds();

        if (!yVideoIds.length) {
          showDebug("❌ No videos found in playlist.");
          setStatus("No videos found");
          return;
        }

        yOrder = shuffle([...yVideoIds]); // random order of videoIds
        yPos = 0;
        yLoadedOnce = true;
      } else {
        // Every open: start from a new random first video (fresh feel)
        yOrder = shuffle([...yVideoIds]);
        yPos = 0;
      }

      buildFullscreenPlayerContainer();

      const firstId = currentVideoId();
      setStatus("Playing random…");

      // Destroy old player if exists
      try {
        if (yPlayer && yPlayer.destroy) yPlayer.destroy();
      } catch (e) {}

      yPlayer = new YT.Player("yennam_player", {
        videoId: firstId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            // Try to autoplay (works because user clicked button)
            try { yPlayer.playVideo(); } catch (e) {}
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              const nextId = nextVideoId();
              setStatus("Next random…");
              try {
                yPlayer.loadVideoById(nextId);
              } catch (err) {
                showDebug("❌ loadVideoById failed: " + (err?.message || err));
              }
            }
          },
          onError: (e) => {
            // Common errors: 2 (invalid id), 5 (HTML5), 100/101/150 restricted
            showDebug("❌ Player error code: " + e.data);
          }
        }
      });

    } catch (err) {
      console.error(err);
      showDebug("❌ " + (err?.message || err));
      setStatus("Error");
    }
  }

  // =========================
  // DOM ready setup
  // =========================
  function setup() {
    ySection = $("yennamReelsSection");
    yFeed = $("yennamFeed");
    yCloseBtn = $("yennamCloseBtn");

    if (!ySection || !yFeed || !yCloseBtn || !$("yennamStatus")) {
      showDebug("❌ Yennam elements not found. Check IDs: yennamReelsSection, yennamFeed, yennamCloseBtn, yennamStatus.");
      return;
    }

    yCloseBtn.addEventListener("click", closeYennam);

    // make callable from HTML button onclick
    window.openYennamReels = openYennam;

    // optional: confirm script loaded
    // showDebug("✅ main.js loaded. Tap the Yennam button.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
