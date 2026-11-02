(function () {
  var C = window.NOS || {};
  var body = document.body;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---------- opening reveal: once per visit ----------
  var intro = document.querySelector(".intro");
  if (intro) {
    var seen = false;
    try { seen = sessionStorage.getItem("nos-intro") === "1"; sessionStorage.setItem("nos-intro", "1"); } catch (e) {}
    if (seen || reduce) document.documentElement.classList.add("intro-done");
    else intro.addEventListener("animationend", function (e) {
      if (e.animationName === "intro-out") document.documentElement.classList.add("intro-done");
    });
  }

  // ---------- full-screen menu ----------
  var menu = document.querySelector(".menu");
  var lastFocus;
  function setMenu(open) {
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", !open);
    document.querySelectorAll("[data-menu-open]").forEach(function (b) { b.setAttribute("aria-expanded", open); });
    body.style.overflow = open ? "hidden" : "";
    if (open) { lastFocus = document.activeElement; menu.querySelector("nav a").focus(); }
    else if (lastFocus) lastFocus.focus();
  }
  if (menu) {
    document.querySelectorAll("[data-menu-open]").forEach(function (b) { b.addEventListener("click", function () { setMenu(true); }); });
    menu.querySelector("[data-menu-close]").addEventListener("click", function () { setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false); });
  }

  // ---------- scroll-driven pieces ----------
  var hero = document.querySelector(".hero");
  var heroInner = document.querySelector(".hero-inner");
  var words = [];
  document.querySelectorAll(".reveal-text").forEach(function (el) {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    words.push(el);
  });
  var ghosts = document.querySelectorAll(".ghost");
  var steps = document.querySelector(".steps");

  var headerLogo = document.querySelector(".home .header-logo");
  function logoSizes() {
    // [size at the top of the page, size once scrolled], in px
    var w = window.innerWidth;
    return w < 640 ? [94, 70] : w < 1000 ? [128, 80] : [152, 88];
  }

  function onScroll() {
    var y = window.scrollY, vh = window.innerHeight;

    if (hero) {
      var heroH = hero.offsetHeight;
      body.classList.toggle("over-hero", y < heroH - 76);
      if (headerLogo) {
        var sz = logoSizes();
        var p = reduce ? (y > 40 ? 1 : 0) : clamp(y / 320, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        headerLogo.style.setProperty("--logo-w", (sz[0] + (sz[1] - sz[0]) * e).toFixed(1) + "px");
      }
      if (heroInner && !reduce) {
        var f = clamp(y / (heroH * 0.5), 0, 1);
        heroInner.style.opacity = 1 - f;
        heroInner.style.transform = "translateY(" + (-f * 40) + "px)";
      }
    }

    if (!reduce) {
      words.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
        var spans = el.children, n = spans.length;
        for (var i = 0; i < n; i++) spans[i].style.setProperty("--o", clamp(p * n - i, 0.14, 1));
      });
      ghosts.forEach(function (g) {
        var r = g.parentElement.getBoundingClientRect();
        g.style.setProperty("--gx", ((r.top - vh) * 0.25).toFixed(1) + "px");
      });
      if (steps) {
        var r = steps.getBoundingClientRect();
        steps.style.setProperty("--fill", clamp((vh * 0.6 - r.top) / r.height, 0, 1));
      }
    }
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // ---------- videos: only play while on screen, and only show once playing ----------
  var vids = Array.prototype.slice.call(document.querySelectorAll("video[data-autoplay]"));
  var heroV = document.querySelector(".hero video");
  if (heroV) {
    // phones and slow connections get the lighter 720p loop
    var conn = navigator.connection || {};
    var small = window.innerWidth < 900 || conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || "");
    heroV.src = C.reelUrl || heroV.getAttribute(small ? "data-src-small" : "data-src-large");
  }
  vids.forEach(function (v) {
    v.muted = true; // iOS only autoplays when the property, not just the attribute, is set
    if (v.poster && v.parentElement !== hero) v.parentElement.style.backgroundImage = "url(" + v.poster + ")";
    v.addEventListener("playing", function () { v.classList.add("is-playing"); });
  });
  var tryPlay = function (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); };
  var onScreen = function (v) { var r = v.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };
  if (!reduce) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) tryPlay(en.target); else en.target.pause(); });
      }, { threshold: 0.15 });
      vids.forEach(function (v) { io.observe(v); });
    } else vids.forEach(tryPlay);
    // if the phone blocked autoplay (e.g. Low Power Mode), the first tap anywhere starts them
    var kick = function () {
      vids.forEach(function (v) { if (v.paused && onScreen(v)) tryPlay(v); });
      document.removeEventListener("touchend", kick); document.removeEventListener("click", kick);
    };
    document.addEventListener("touchend", kick, { passive: true });
    document.addEventListener("click", kick);
  }

  // ---------- O‘ahu slider ----------
  var slider = document.querySelector(".slider");
  if (slider) {
    var prev = document.querySelector("[data-slide='prev']"), next = document.querySelector("[data-slide='next']");
    var bar = document.querySelector(".slider-bar");
    var step = function () { var s = slider.querySelector(".slide"); return s.offsetWidth + 16; };
    var update = function () {
      var max = slider.scrollWidth - slider.clientWidth;
      var vis = slider.clientWidth / slider.scrollWidth;
      bar.style.setProperty("--bar", ((vis + (1 - vis) * (max ? slider.scrollLeft / max : 1)) * 100).toFixed(1) + "%");
      prev.disabled = slider.scrollLeft < 4;
      next.disabled = slider.scrollLeft > max - 4;
    };
    prev.addEventListener("click", function () { slider.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }); });
    next.addEventListener("click", function () { slider.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }); });
    slider.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ---------- swap placeholders for real media once config is filled in ----------
  function embed(el, url, title) {
    if (!el || !url) return;
    var node;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      node = document.createElement("video");
      node.src = url; node.controls = true; node.playsInline = true;
    } else {
      node = document.createElement("iframe");
      node.src = url; node.title = title;
      node.allow = "autoplay; fullscreen; picture-in-picture"; node.allowFullscreen = true;
    }
    el.innerHTML = "";
    el.appendChild(node);
  }
  embed(document.querySelector('[data-embed="vsl"]'), C.vslUrl, "How working with nosMedia works");

  var cal = document.querySelector('[data-embed="calendar"]');
  if (cal && C.calendarUrl) {
    cal.innerHTML = "";
    var f = document.createElement("iframe");
    f.src = C.calendarUrl; f.title = "Pick a time for your call";
    cal.appendChild(f);
  }

  // ---------- inquiry form: opens a pre-filled email to Carson (no server yet) ----------
  var inquiry = document.querySelector("#inquiry");
  if (inquiry) {
    inquiry.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(inquiry);
      var status = inquiry.querySelector(".form-status");
      if (!d.get("name") || !d.get("email")) {
        status.textContent = "Add your name and email so Carson can reply.";
        status.className = "form-status error";
        return;
      }
      var text = ["Name: " + d.get("name"), "Email: " + d.get("email"), "Phone: " + (d.get("phone") || "-"), "Project: " + d.get("type"), "", d.get("message") || ""].join("\n");
      location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent("New inquiry from " + d.get("name")) + "&body=" + encodeURIComponent(text);
      status.textContent = "Your email app is opening with the message ready. Press send there.";
      status.className = "form-status";
    });
  }

  // ---------- 5-star review funnel ----------
  var funnel = document.querySelector("#funnel");
  if (funnel) {
    var stars = funnel.querySelectorAll(".star");
    var hint = funnel.querySelector(".star-hint");
    var labels = ["", "Not good", "Could be better", "It was okay", "Really good", "Loved it"];
    var show = function (id) {
      funnel.querySelectorAll(".review-step").forEach(function (s) { s.hidden = s.id !== id; });
      var h = document.getElementById(id).querySelector("h1");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    };
    var light = function (n) { stars.forEach(function (s, i) { s.classList.toggle("lit", i < n); }); hint.textContent = labels[n] || ""; };
    var google = C.googleReviewUrl || "#google-review-link-coming-soon";
    funnel.querySelectorAll("[data-google]").forEach(function (a) { a.href = google; });
    stars.forEach(function (s, i) {
      s.addEventListener("mouseenter", function () { light(i + 1); });
      s.addEventListener("focus", function () { light(i + 1); });
      s.addEventListener("click", function () {
        funnel.dataset.rating = i + 1;
        show(i + 1 >= 4 ? "step-happy" : "step-private");
      });
    });
    funnel.querySelector(".stars").addEventListener("mouseleave", function () { light(0); });
    var priv = document.querySelector("#private-feedback");
    priv.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(priv);
      var text = "Rating: " + funnel.dataset.rating + " of 5\nName: " + (d.get("name") || "-") + "\n\n" + (d.get("feedback") || "");
      location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent("Private feedback for nosMedia") + "&body=" + encodeURIComponent(text);
      show("step-thanks");
    });
  }
})();
