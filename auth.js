/* Browser PIN gate. Compares a salted SHA-256 hash. Does not store the PIN. */
var VarsaAuth = (function () {
  var SESSION_KEY = "varsa.gate";
  var TRIES_KEY = "varsa.gateTries";
  var TWELVE_H = 12 * 60 * 60 * 1000;
  var LOCK_MS = 60 * 1000;
  var MAX_TRIES = 5;
  var styled = false;

  function session() {
    var raw;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!data || (data.role !== "manager" && data.role !== "cashier")) return null;
      if (!data.exp || Date.now() > data.exp) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveSession(role) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role: role, exp: Date.now() + TWELVE_H }));
    localStorage.removeItem(TRIES_KEY);
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function tries() {
    try {
      var data = JSON.parse(localStorage.getItem(TRIES_KEY) || "");
      if (!data || typeof data.n !== "number") return { n: 0, until: 0 };
      if (data.until && data.until <= Date.now()) return { n: 0, until: 0 };
      return data;
    } catch (e) {
      return { n: 0, until: 0 };
    }
  }

  function hashPin(salt, pin) {
    var bytes = new TextEncoder().encode(String(salt) + ":" + String(pin));
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function sameHex(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function check(pin, allowed) {
    var state = tries();
    if (state.until && state.until > Date.now()) {
      return Promise.resolve({ ok: false, locked: true, until: state.until });
    }
    var roles = allowed.slice();
    function step(i) {
      if (i >= roles.length) {
        state.n += 1;
        if (state.n >= MAX_TRIES) state.until = Date.now() + LOCK_MS;
        localStorage.setItem(TRIES_KEY, JSON.stringify(state));
        return { ok: false, locked: state.n >= MAX_TRIES, left: MAX_TRIES - state.n, until: state.until };
      }
      var role = roles[i];
      var cfg = (window.VARSA_AUTH || {})[role];
      if (!cfg || !cfg.salt || !cfg.hash) return step(i + 1);
      return hashPin(cfg.salt, pin).then(function (hex) {
        if (sameHex(hex, String(cfg.hash).toLowerCase())) {
          saveSession(role);
          return { ok: true, role: role };
        }
        return step(i + 1);
      });
    }
    return Promise.resolve(step(0));
  }

  function ensureStyle() {
    if (styled) return;
    styled = true;
    var css = document.createElement("style");
    css.textContent = [
      ".vpin{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:28px 16px 40px;background:#f3f5f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1F2A44}",
      ".vpin-card{width:min(420px,100%)}",
      ".vpin-hero{background:#1F2A44;color:#fff;border-radius:20px;padding:20px 18px 18px;margin-bottom:14px}",
      ".vpin-hero p{margin:0;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;opacity:.85;font-weight:650}",
      ".vpin-hero h1{margin:6px 0 4px;font-size:1.7rem;line-height:1.15}",
      ".vpin-hero span{display:block;font-size:.95rem;line-height:1.4;opacity:.92;font-weight:500}",
      ".vpin-pad{background:#fff;border:1px solid #d5dbe3;border-radius:20px;padding:16px}",
      ".vpin-dots{min-height:42px;margin:0 0 12px;text-align:center;letter-spacing:.4em;font-size:1.8rem;font-weight:700;color:#1F2A44}",
      ".vpin-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
      ".vpin-keys button{font:inherit;font-size:1.45rem;font-weight:750;min-height:68px;border-radius:16px;border:1px solid #d5dbe3;background:#e7ebf0;color:#1F2A44}",
      ".vpin-keys button:active{background:#1F2A44;color:#fff}",
      ".vpin-keys button:disabled{opacity:.45}",
      ".vpin-keys button.vpin-go{grid-column:1 / -1;background:#1F2A44;color:#fff;border-color:#1F2A44;font-size:1.1rem}",
      ".vpin-msg{min-height:2.6em;margin:12px 4px 0;text-align:center;color:#5c6773;font-weight:650;line-height:1.35}"
    ].join("");
    document.head.appendChild(css);
  }

  function mount(root, opts) {
    ensureStyle();
    var allowed = opts.allowed || ["manager", "cashier"];
    var digits = "";
    var timer = 0;
    root.hidden = false;
    root.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "vpin";
    var card = document.createElement("div");
    card.className = "vpin-card";
    var hero = document.createElement("div");
    hero.className = "vpin-hero";
    hero.innerHTML = "<p>Varsa Group</p><h1>Varsa Group</h1><span>Thomasville Chevron and Thomasville Outrun</span>";
    var pad = document.createElement("div");
    pad.className = "vpin-pad";
    var dots = document.createElement("div");
    dots.className = "vpin-dots";
    dots.setAttribute("aria-live", "polite");
    var keys = document.createElement("div");
    keys.className = "vpin-keys";
    var msg = document.createElement("p");
    msg.className = "vpin-msg";
    var prompt = allowed.length === 1 && allowed[0] === "manager" ? "Enter the manager PIN." : "Enter your PIN.";
    msg.textContent = prompt;

    function paint() {
      dots.textContent = digits ? new Array(digits.length + 1).join("•") : "";
      dots.setAttribute("aria-label", digits.length + " digits entered");
    }
    function setLocked(on) {
      keys.querySelectorAll("button").forEach(function (btn) { btn.disabled = on; });
    }
    function lockLeft(until) {
      var secs = Math.max(1, Math.ceil((until - Date.now()) / 1000));
      msg.textContent = "Too many tries. The keypad is paused for " + secs + " seconds.";
      setLocked(true);
      clearInterval(timer);
      timer = setInterval(function () {
        if (Date.now() >= until) {
          clearInterval(timer);
          setLocked(false);
          msg.textContent = prompt;
          return;
        }
        var left = Math.max(1, Math.ceil((until - Date.now()) / 1000));
        msg.textContent = "Too many tries. The keypad is paused for " + left + " seconds.";
      }, 250);
    }
    function press(n) {
      if (digits.length >= 8) return;
      digits += String(n);
      paint();
      if (msg.textContent.indexOf("Wrong") === 0 || msg.textContent.indexOf("Enter 4") === 0) msg.textContent = prompt;
    }
    function submit() {
      if (digits.length < 4) {
        msg.textContent = "Enter 4 to 8 digits.";
        return;
      }
      var entered = digits;
      setLocked(true);
      check(entered, allowed).then(function (res) {
        if (res.ok) {
          clearInterval(timer);
          if (opts.onSuccess) opts.onSuccess(res.role);
          return;
        }
        digits = "";
        paint();
        if (res.locked) lockLeft(res.until);
        else {
          setLocked(false);
          msg.textContent = "Wrong PIN. Try again.";
        }
      }).catch(function () {
        setLocked(false);
        msg.textContent = "The PIN check could not run. Reload and try again.";
      });
    }

    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = String(n);
      b.addEventListener("click", function () { press(n); });
      keys.appendChild(b);
    });
    var blank = document.createElement("button");
    blank.type = "button";
    blank.tabIndex = -1;
    blank.setAttribute("aria-hidden", "true");
    blank.style.visibility = "hidden";
    var zero = document.createElement("button");
    zero.type = "button";
    zero.textContent = "0";
    zero.addEventListener("click", function () { press(0); });
    var back = document.createElement("button");
    back.type = "button";
    back.textContent = "Del";
    back.style.fontSize = "1.05rem";
    back.setAttribute("aria-label", "Delete");
    back.addEventListener("click", function () { digits = digits.slice(0, -1); paint(); });
    var go = document.createElement("button");
    go.type = "button";
    go.className = "vpin-go";
    go.textContent = "Enter";
    go.addEventListener("click", submit);
    keys.append(blank, zero, back, go);
    pad.append(dots, keys, msg);
    card.append(hero, pad);
    wrap.appendChild(card);
    root.appendChild(wrap);

    document.addEventListener("keydown", onKey);
    function onKey(e) {
      if (root.hidden) return;
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") { digits = digits.slice(0, -1); paint(); e.preventDefault(); }
      else if (e.key === "Enter") submit();
    }
    root._varsaOff = function () { document.removeEventListener("keydown", onKey); clearInterval(timer); };

    var existing = tries();
    if (existing.until && existing.until > Date.now()) lockLeft(existing.until);
    paint();
  }

  return { session: session, logout: logout, mount: mount };
})();
