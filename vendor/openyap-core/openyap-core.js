/* ============================================================================
   openyap-core.js  —  the shared "one advanced stack" runtime for OpenYap
   ----------------------------------------------------------------------------
   Every OpenYap production app loads this ONE file (after the Firebase compat
   SDK) and gets:
     • one canonical Firebase project + init (the new secured openyap-prod)
     • App Check (reCAPTCHA v3)
     • one auth session shared across all apps (same dyap123.github.io origin)
     • a sign-in / access-pending / ready gate
     • roles from custom claims + a shared capability matrix  (oy.can(cap))
     • design tokens (--oy-*) + a tiny UI kit (toast, gate overlay)

   Exposes a single global:  window.oy
   No build step — authored as the file apps include directly.
   Requires (loaded BEFORE this file), Firebase compat 10.x:
     firebase-app-compat.js, firebase-database-compat.js,
     firebase-auth-compat.js, firebase-app-check-compat.js (optional)
   ============================================================================ */
(function () {
  "use strict";
  if (window.oy && window.oy.__ready) return; // idempotent

  /* ======================================================================
     1. CONFIG  —  the ONLY place to paste your new-project values.
     (An app may override by setting window.OY_CONFIG before this script.)
     ====================================================================== */
  var FIREBASE_CONFIG = (window.OY_CONFIG && window.OY_CONFIG.firebase) || {
    apiKey:      "AIzaSyCt_2_-CpGq3yuu-54dEw4uYgomGDrb6DU",   // openyap-prod web app
    authDomain:  "openyap-prod.firebaseapp.com",
    projectId:   "openyap-prod",
    databaseURL: "https://openyap-prod-default-rtdb.firebaseio.com",
    appId:       "1:849339454708:web:0b0882d17613c6a18f3aa1",
  };
  // reCAPTCHA v3 site key for App Check. Leave the placeholder to skip App Check
  // locally; paste the real key to enable it. (Also add firebase-app-check-compat.js)
  var APPCHECK_SITE_KEY =
    (window.OY_CONFIG && window.OY_CONFIG.appCheckSiteKey) || "PASTE_RECAPTCHA_V3_SITE_KEY";

  var CONFIG_OK = /^AIza/.test(FIREBASE_CONFIG.apiKey || "");
  var APPCHECK_OK = /\S/.test(APPCHECK_SITE_KEY) && !/^PASTE_/.test(APPCHECK_SITE_KEY);
  // Contact shown to users blocked at the door (server-enforced allowlist).
  var ADMIN_CONTACT = (window.OY_CONFIG && window.OY_CONFIG.adminContact) || "dyap123@gmail.com";

  /* ======================================================================
     2. ROLES + CAPABILITY MATRIX  (single source of truth for all apps)
     Roles come from the Firebase custom claim `role` (Admin|Super|PM|PE).
     ====================================================================== */
  var ROLES = [
    { key: "admin", name: "Admin", desc: "Full edit of all data",              accent: "#D946EF" },
    { key: "super", name: "Super", desc: "Schedule · Tools · Crew",            accent: "#F59E0B" },
    { key: "pm",    name: "PM",    desc: "RFIs · Submittals · Inspections",    accent: "#3B82F6" },
    { key: "pe",    name: "PE",    desc: "Data · Zones · Pours",               accent: "#8B5CF6" },
  ];
  // capability -> which role keys may perform it
  var CAP = {
    rfiEdit:    ["admin", "super", "pm", "pe"],
    zoneEdit:   ["admin", "pe"],
    mapCalib:   ["admin", "pe"],
    markupEdit: ["admin", "pm", "pe"],
    scheduleEdit: ["admin", "super"],
    inspect:    ["admin", "pm", "pe"],
    pourEdit:   ["admin", "super", "pm", "pe"],
    toolEdit:   ["admin", "super", "pm", "pe"],
    attendanceEdit: ["admin", "super", "pm", "pe"],
    adminUsers: ["admin"],
  };

  /* ======================================================================
     3. STATE
     ====================================================================== */
  var app = null, db = null, auth = null, appCheck = null;
  var ME = { uid: null, email: null, name: null, role: null, claims: null };
  var readyCbs = [], authCbs = [];
  var _readyResolvers = [];
  var _state = "boot"; // boot | signedout | norole | ready

  /* ======================================================================
     4. FIREBASE INIT  (idempotent)
     ====================================================================== */
  function init(opts) {
    if (app) return oy;
    opts = opts || {};
    if (typeof firebase === "undefined") {
      console.error("[oy] Firebase compat SDK not found — load it before openyap-core.js");
      return oy;
    }
    try {
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      // App Check first, so DB/Auth calls carry the token.
      if (APPCHECK_OK && firebase.appCheck) {
        try {
          appCheck = firebase.appCheck();
          appCheck.activate(APPCHECK_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
        } catch (e) { console.warn("[oy] App Check activate failed:", e && e.message); }
      }
      db = firebase.database();
      if (CONFIG_OK) auth = firebase.auth();
      oy.db = db; oy.auth = auth; oy.app = app;
    } catch (e) {
      console.error("[oy] init failed:", e);
    }
    return oy;
  }

  /* ======================================================================
     5. AUTH GATE
     ensureAuth() wires onAuthStateChanged, renders the right overlay, and
     resolves once the user is signed-in AND has a role claim.
     ====================================================================== */
  function ensureAuth(opts) {
    init(opts);
    if (!CONFIG_OK) {
      // No real config yet — fail loud, but do not hard-crash the app shell.
      showGate("config", null);
      return Promise.reject(new Error("openyap-core: paste your Firebase web config into openyap-core.js"));
    }
    if (!oy.__wired) {
      oy.__wired = true;
      auth.onAuthStateChanged(async function (u) {
        if (!u) {
          ME = { uid: null, email: null, name: null, role: null, claims: null };
          _state = "signedout";
          fireAuth();
          showGate("signin", null);
          return;
        }
        ME.uid = u.uid; ME.email = u.email; ME.name = u.displayName || u.email;
        var role = null, claims = null;
        try {
          var tok = await u.getIdTokenResult();
          claims = tok.claims || {};
          role = (claims.role || "").toString();
        } catch (e) { /* ignore */ }
        ME.claims = claims; ME.role = role || null;
        if (!role) {
          _state = "norole";
          // register a pending access request so an admin can see + grant them
          try {
            db.ref("command-center/access_requests/" + u.uid).update({
              email: u.email || null, name: u.displayName || null,
              requestedAt: firebase.database.ServerValue.TIMESTAMP,
            });
          } catch (e) { /* rules gate this to self-writes; harmless if it fails */ }
          fireAuth();
          showGate("norole", u);
          return;
        }
        _state = "ready";
        hideGate();
        fireAuth();
        fireReady();
      });
    }
    return new Promise(function (resolve) {
      if (_state === "ready") resolve(ctx());
      else _readyResolvers.push(resolve);
    });
  }

  function ctx() { return { uid: ME.uid, email: ME.email, name: ME.name, role: roleKey(), me: Object.assign({}, ME) }; }
  function fireReady() { var c = ctx(); readyCbs.forEach(function (cb) { try { cb(c); } catch (e) { console.error(e); } });
    _readyResolvers.splice(0).forEach(function (r) { r(c); }); }
  function fireAuth() { var c = ctx(); authCbs.forEach(function (cb) { try { cb(c, _state); } catch (e) { console.error(e); } }); }

  function onReady(cb) { readyCbs.push(cb); if (_state === "ready") cb(ctx()); return oy; }
  function onAuth(cb) { authCbs.push(cb); cb(ctx(), _state); return oy; }

  /* ---- sign-in actions ---- */
  // Blocking-function rejections arrive wrapped (auth/internal-error). Surface the human message.
  function friendlyAuthErr(e) {
    var m = (e && e.message) || "";
    var mm = m.match(/Not approved[^"”]*/) || m.match(/Only Google[^"”]*/) || m.match(/Too many sign-in[^"”]*/);
    if (mm) return mm[0].trim();
    if (/BLOCKING_FUNCTION|internal-error/i.test(m)) return "Not approved — email " + ADMIN_CONTACT + " to request access.";
    if (/popup-closed|cancelled-popup|popup_closed/i.test(m)) return ""; // user dismissed the popup
    return m;
  }
  function signInGoogle() {
    init();
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return auth.signInWithPopup(p).catch(function (e) { gateErr(friendlyAuthErr(e)); throw e; });
  }
  function signInEmail(email, pw, o) {
    init();
    o = o || {};
    email = (email || "").trim();
    if (!email || !pw) { gateErr("Email and password required"); return Promise.reject(new Error("missing")); }
    var fn = o.create ? "createUserWithEmailAndPassword" : "signInWithEmailAndPassword";
    return auth[fn](email, pw).catch(function (e) { gateErr(e.message); throw e; });
  }
  function signOut() { if (auth) return auth.signOut(); return Promise.resolve(); }

  /* ======================================================================
     6. ROLES / CAPABILITIES
     ====================================================================== */
  function roleKey() { return (ME.role || "").toLowerCase() || null; }
  function role() { return roleKey(); }
  function is(k) { return roleKey() === String(k).toLowerCase(); }
  function can(cap) { var r = roleKey(); if (!r) return false; return (CAP[cap] || []).indexOf(r) !== -1; }
  function me() { return Object.assign({}, ME); }

  /* ======================================================================
     7. DESIGN TOKENS + UI KIT (namespaced .oy-* / --oy-* — won't clash)
     ====================================================================== */
  function injectStyles() {
    if (document.getElementById("oy-core-style")) return;
    var css = [
      ":root{",
      "--oy-bg:#0B0E13;--oy-surface:rgba(255,255,255,.035);--oy-border:rgba(255,255,255,.08);",
      "--oy-text:#E6E9EF;--oy-muted:#8A92A0;--oy-faint:#5B636F;",
      "--oy-purple:#8B5CF6;--oy-blue:#3B82F6;--oy-magenta:#D946EF;--oy-amber:#F59E0B;",
      "--oy-green:#22C55E;--oy-red:#EF4444;--oy-cyan:#22D3EE;",
      "--oy-grad:linear-gradient(135deg,#8B5CF6,#3B82F6 55%,#D946EF);",
      "--oy-font:Inter,system-ui,sans-serif;--oy-mono:'JetBrains Mono',ui-monospace,monospace;}",
      "@keyframes oyCoreUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes oyCoreShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}",
      ".oy-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;",
      "background:radial-gradient(1200px 600px at 50% -10%,rgba(139,92,246,.18),transparent 60%),var(--oy-bg);",
      "font-family:var(--oy-font);color:var(--oy-text)}",
      ".oy-card{width:380px;max-width:94vw;padding:30px 28px;border-radius:20px;text-align:center;",
      "background:linear-gradient(160deg,rgba(255,255,255,.055),rgba(255,255,255,.02));",
      "border:1px solid var(--oy-border);backdrop-filter:blur(10px);animation:oyCoreUp .4s ease both;",
      "box-shadow:0 30px 80px rgba(0,0,0,.5)}",
      ".oy-diamond{width:46px;height:46px;margin:0 auto 16px;border-radius:13px;transform:rotate(45deg);",
      "background:var(--oy-grad);box-shadow:0 10px 30px -8px rgba(139,92,246,.7)}",
      ".oy-title{font-size:19px;font-weight:700;letter-spacing:-.2px}",
      ".oy-sub{font-size:12.5px;color:var(--oy-muted);margin:6px 0 22px;line-height:1.5}",
      ".oy-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:12px;margin-top:10px;",
      "border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;border:1px solid var(--oy-border);",
      "background:rgba(255,255,255,.05);color:var(--oy-text);transition:.15s}",
      ".oy-btn:hover{background:rgba(255,255,255,.09)}",
      ".oy-btn.oy-primary{border:0;color:#fff;background:var(--oy-grad)}",
      ".oy-in{width:100%;padding:11px 13px;margin-top:9px;border-radius:11px;font-size:13.5px;color:var(--oy-text);",
      "background:rgba(255,255,255,.05);border:1px solid var(--oy-border);outline:none;color-scheme:dark}",
      ".oy-in:focus{border-color:rgba(139,92,246,.55)}",
      ".oy-div{display:flex;align-items:center;gap:10px;margin:18px 0 6px;color:var(--oy-faint);font-size:10.5px;",
      "text-transform:uppercase;letter-spacing:.6px;font-family:var(--oy-mono)}",
      ".oy-div::before,.oy-div::after{content:'';flex:1;height:1px;background:var(--oy-border)}",
      ".oy-err{color:#FCA5A5;font-size:12px;min-height:16px;margin-top:12px}",
      ".oy-link{color:var(--oy-muted);font-size:12px;cursor:pointer;margin-top:14px;display:inline-block}",
      ".oy-link:hover{color:var(--oy-text)}",
      "#oy-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;",
      "flex-direction:column;gap:8px;align-items:center;font-family:var(--oy-font)}",
      ".oy-toast{padding:10px 16px;border-radius:11px;background:rgba(22,26,33,.96);backdrop-filter:blur(12px);",
      "border:1px solid var(--oy-border);font-size:12.5px;color:var(--oy-text);animation:oyCoreUp .2s}",
      ".oy-toast.ok{border-color:rgba(34,197,94,.5)}.oy-toast.err{border-color:rgba(239,68,68,.5)}",
      ".oy-toast.warn{border-color:rgba(245,158,11,.5)}",
    ].join("");
    var s = document.createElement("style");
    s.id = "oy-core-style"; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- toast ---- */
  function toast(msg, type) {
    injectStyles();
    var host = document.getElementById("oy-toast");
    if (!host) { host = document.createElement("div"); host.id = "oy-toast"; document.body.appendChild(host); }
    var el = document.createElement("div");
    el.className = "oy-toast " + (type || "");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.style.opacity = "0"; el.style.transition = ".3s"; setTimeout(function () { el.remove(); }, 300); }, 2600);
  }

  /* ---- gate overlay (signin / norole / config) ---- */
  function gateEl() { return document.getElementById("oy-gate"); }
  function hideGate() { var g = gateEl(); if (g) g.remove(); }
  function gateErr(m) { var e = document.getElementById("oy-gate-err"); if (e) e.textContent = m || ""; }

  function showGate(kind, user) {
    injectStyles();
    hideGate();
    var g = document.createElement("div");
    g.id = "oy-gate"; g.className = "oy-gate";
    var appName = (window.OY_APP_NAME || "OpenYap");
    var inner = "";
    if (kind === "config") {
      inner =
        '<div class="oy-card"><div class="oy-diamond"></div>' +
        '<div class="oy-title">Setup required</div>' +
        '<div class="oy-sub">openyap-core has no Firebase config yet.<br>Paste your <b>openyap-prod</b> web config into <code>openyap-core.js</code>.</div>' +
        "</div>";
    } else if (kind === "norole") {
      inner =
        '<div class="oy-card"><div class="oy-diamond"></div>' +
        '<div class="oy-title">Access pending</div>' +
        '<div class="oy-sub">You are signed in as <b>' + esc(user && user.email) + "</b>.<br>" +
        "An admin needs to grant your role before you can use " + esc(appName) + ".</div>" +
        '<button class="oy-btn" id="oy-signout">Sign out</button>' +
        '<div class="oy-link" id="oy-refresh">I just got access — refresh</div>' +
        "</div>";
    } else {
      // signin — Google-only; access is limited to approved accounts (server-enforced allowlist).
      inner =
        '<div class="oy-card"><div class="oy-diamond"></div>' +
        '<div class="oy-title">' + esc(appName) + "</div>" +
        '<div class="oy-sub">Sign in with your approved Google account.</div>' +
        '<button class="oy-btn oy-primary" id="oy-google">' +
        '<span>🔐</span> Continue with Google</button>' +
        '<div class="oy-err" id="oy-gate-err"></div>' +
        '<div class="oy-sub" style="margin-top:16px;font-size:11.5px;line-height:1.5">Access is limited to approved accounts.<br>Email <b>' + esc(ADMIN_CONTACT) + "</b> to request access.</div>" +
        "</div>";
    }
    g.innerHTML = inner;
    document.body.appendChild(g);

    var byId = function (i) { return document.getElementById(i); };
    if (byId("oy-google")) byId("oy-google").onclick = function () { signInGoogle().catch(function () {}); };
    if (byId("oy-signout")) byId("oy-signout").onclick = function () { signOut(); };
    if (byId("oy-refresh")) byId("oy-refresh").onclick = async function () {
      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (e) {}
      location.reload();
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ======================================================================
     8. MINIMAX COPILOT via secure proxy (never the raw key client-side)
     Calls the mmProxy Cloud Function with the caller's Firebase ID token.
     ====================================================================== */
  async function copilot(messages, opts) {
    opts = opts || {};
    if (!auth || !auth.currentUser) throw new Error("not signed in");
    var token = await auth.currentUser.getIdToken();
    var url = (window.OY_CONFIG && window.OY_CONFIG.mmProxyUrl) ||
      ("https://us-central1-" + FIREBASE_CONFIG.projectId + ".cloudfunctions.net/mmProxy");
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ system: opts.system || "", messages: messages, max_tokens: opts.max_tokens || 700 }),
    });
    var data = await res.json();
    if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    var reply = "";
    if (data && data.content && data.content.length) reply = data.content.map(function (c) { return c.text || ""; }).join("").trim();
    return reply;
  }

  /* ---- admin: set a user's role (calls the admin-only setRole function) ---- */
  async function setRole(identifier, role) {
    if (!auth || !auth.currentUser) throw new Error("not signed in");
    var token = await auth.currentUser.getIdToken();
    var url = (window.OY_CONFIG && window.OY_CONFIG.setRoleUrl) ||
      ("https://us-central1-" + FIREBASE_CONFIG.projectId + ".cloudfunctions.net/setRole");
    var body = {};
    if (typeof identifier === "string" && identifier.indexOf("@") !== -1) body.email = identifier;
    else body.uid = identifier;
    if (role === null || role === "none") body.remove = true; else body.role = role;  // role:null revokes
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
    });
    var data = await res.json();
    if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  }

  /* ======================================================================
     9. PUBLIC API
     ====================================================================== */
  var oy = {
    __ready: true,
    version: "0.1.0",
    config: FIREBASE_CONFIG,
    configOk: CONFIG_OK,
    appCheckOk: APPCHECK_OK,
    app: null, db: null, auth: null,
    ROLES: ROLES, CAP: CAP,
    init: init,
    ensureAuth: ensureAuth,
    onReady: onReady,
    onAuth: onAuth,
    signInGoogle: signInGoogle,
    signInEmail: signInEmail,
    signOut: signOut,
    me: me, role: role, roleKey: roleKey, is: is, can: can,
    toast: toast,
    copilot: copilot,
    setRole: setRole,
    // low-level UI escape hatches (used by app shells if they render their own gate)
    _showGate: showGate, _hideGate: hideGate,
  };
  window.oy = oy;
})();
