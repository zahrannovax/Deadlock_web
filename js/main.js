/* ==========================================================================
   Zadeyo Deadlock Cheats — Global Scripts
   Mobile nav toggle + custom video play overlay + FAQ helpers.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  initMobileNav();
  initVideoOverlay();
  initVideoMuteToggle();
  initNewsletterForm();
  initTiltCards();
  initLanguageSwitcher();
  initSmoothScroll();
});

/**
 * Wires up Lenis (loaded from a CDN in <head>) for eased, momentum-style
 * scrolling instead of the browser's instant/linear scroll. Skipped
 * entirely for users who prefer reduced motion, and fails silently if the
 * Lenis script hasn't loaded (e.g. blocked by an ad-blocker/offline) so
 * the page still scrolls normally either way.
 */
function initSmoothScroll() {
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || typeof window.Lenis !== "function") {
    return;
  }

  var lenis = new window.Lenis({
    duration: 1.1,
    smoothWheel: true,
    autoRaf: true
  });

  // Keep the nav's language dropdown, Discord popovers, etc. in sync while
  // the page eases to an anchor link (e.g. the hero's "See preview images"
  // pill) instead of jumping instantly past it.
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") {
        return;
      }
      var target = document.querySelector(targetId);
      if (!target) {
        return;
      }
      event.preventDefault();
      lenis.scrollTo(target, { offset: -84 });
    });
  });
}

/**
 * Toggles the mobile navigation menu.
 */
function initMobileNav() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");

  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    // The header is `position: sticky`, so without this the dropdown stays
    // pinned to the viewport while the page behind it keeps scrolling,
    // making its solid background look like an empty void you have to
    // scroll through before the real page content reappears underneath.
    document.body.classList.toggle("nav-menu-open", isOpen);
  });
}

/**
 * Wires up the custom play button overlay on the preview video.
 * Clicking the overlay starts playback and hides the button instantly.
 */
function initVideoOverlay() {
  var wrapper = document.querySelector(".video-wrapper");

  if (!wrapper) {
    return;
  }

  var video = wrapper.querySelector("video");
  var overlay = wrapper.querySelector(".video-play-overlay");

  if (!video || !overlay) {
    return;
  }

  var startPlayback = function () {
    overlay.classList.add("is-hidden");
    video.setAttribute("controls", "controls");
    video.play();
  };

  overlay.addEventListener("click", startPlayback);
  overlay.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startPlayback();
    }
  });

  video.addEventListener("pause", function () {
    if (video.currentTime > 0 && !video.ended) {
      overlay.classList.add("is-hidden");
    }
  });

  video.addEventListener("ended", function () {
    overlay.classList.remove("is-hidden");
  });
}

/**
 * Persistent mute/unmute control for the preview video, independent of
 * the play overlay so it stays usable once playback has started (the
 * play overlay itself fades out and stops intercepting clicks at that
 * point). Videos start unmuted by default; this just gives visitors an
 * obvious way to silence gameplay audio without hunting for native
 * video controls.
 */
function initVideoMuteToggle() {
  var wrapper = document.querySelector(".video-wrapper");

  if (!wrapper) {
    return;
  }

  var video = wrapper.querySelector("video");
  var toggle = wrapper.querySelector(".video-mute-toggle");

  if (!video || !toggle) {
    return;
  }

  toggle.addEventListener("click", function (event) {
    event.stopPropagation();
    video.muted = !video.muted;
    toggle.setAttribute("aria-pressed", video.muted ? "true" : "false");
    toggle.setAttribute("aria-label", video.muted ? "Unmute preview video" : "Mute preview video");
  });
}

/**
 * Footer newsletter form has no backend to submit to, so this just
 * prevents the page reload and gives the visitor a lightweight
 * confirmation instead of a dead GET request.
 */
function initNewsletterForm() {
  var form = document.querySelector(".newsletter-form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var input = form.querySelector(".newsletter-input");
    var button = form.querySelector(".newsletter-submit");

    if (button) {
      button.textContent = "Subscribed!";
      button.disabled = true;
    }
    if (input) {
      input.value = "";
    }
  });
}

/**
 * Mouse-tracked 3D tilt cards with a physics-based spring settle — a
 * vanilla JS/CSS stand-in for the React "TiltedCard" (framer-motion)
 * component. This site has no React, no bundler and no npm dependencies
 * by design (see PROJECT_MEMORY.md), so the same rotateX/rotateY-on-move,
 * scale-on-hover and cursor-tracking glow are reproduced here with plain
 * DOM events + requestAnimationFrame instead of `motion/react`.
 *
 * Skips itself entirely when the visitor has requested reduced motion.
 * Otherwise it relies on real "mousemove" events to drive the tilt —
 * touch input doesn't fire those while dragging/tapping, so touch
 * devices naturally stay static without needing a pointer-type media
 * query (those queries unreliably report "coarse" on some touchscreen
 * Windows laptops even while an actual mouse is being used, which would
 * silently disable the effect for mouse users too).
 */
function initTiltCards() {
  var cards = document.querySelectorAll(".tilt-card");

  if (!cards.length) {
    return;
  }

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    return;
  }

  cards.forEach(setupTiltCard);
}

function setupTiltCard(card) {
  var ROTATE_AMPLITUDE = 10; // max degrees of tilt
  var SCALE_ON_HOVER = 1.04;
  var STIFFNESS = 120;
  var DAMPING = 14;
  var MASS = 1;
  var SETTLE_EPSILON = 0.01;

  var glow = card.querySelector(".tilt-card-glow");

  var axes = {
    rx: { value: 0, velocity: 0, target: 0 },
    ry: { value: 0, velocity: 0, target: 0 },
    scale: { value: 1, velocity: 0, target: 1 }
  };

  var rafId = null;
  var lastTime = null;

  function stepSpring(axis, dt) {
    var force = -STIFFNESS * (axis.value - axis.target);
    var dampingForce = -DAMPING * axis.velocity;
    var acceleration = (force + dampingForce) / MASS;
    axis.velocity += acceleration * dt;
    axis.value += axis.velocity * dt;
  }

  function isSettled() {
    return Object.keys(axes).every(function (key) {
      var axis = axes[key];
      return Math.abs(axis.value - axis.target) < SETTLE_EPSILON && Math.abs(axis.velocity) < SETTLE_EPSILON;
    });
  }

  function render() {
    card.style.transform =
      "perspective(900px) rotateX(" + axes.rx.value.toFixed(2) + "deg) " +
      "rotateY(" + axes.ry.value.toFixed(2) + "deg) " +
      "scale(" + axes.scale.value.toFixed(3) + ")";
  }

  function tick(now) {
    if (lastTime === null) {
      lastTime = now;
    }
    var dt = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;

    stepSpring(axes.rx, dt);
    stepSpring(axes.ry, dt);
    stepSpring(axes.scale, dt);
    render();

    if (isSettled()) {
      rafId = null;
      lastTime = null;
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId === null) {
      lastTime = null;
      rafId = requestAnimationFrame(tick);
    }
  }

  card.addEventListener("mousemove", function (event) {
    var rect = card.getBoundingClientRect();
    var offsetX = event.clientX - rect.left - rect.width / 2;
    var offsetY = event.clientY - rect.top - rect.height / 2;

    axes.rx.target = (offsetY / (rect.height / 2)) * -ROTATE_AMPLITUDE;
    axes.ry.target = (offsetX / (rect.width / 2)) * ROTATE_AMPLITUDE;

    if (glow) {
      var px = ((event.clientX - rect.left) / rect.width) * 100;
      var py = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--tilt-x", px + "%");
      card.style.setProperty("--tilt-y", py + "%");
    }

    startLoop();
  });

  card.addEventListener("mouseenter", function () {
    // Hand off from the CSS-only fallback tilt (see .tilt-card:hover) to
    // the JS spring: drop "transform" from the transitioned properties so
    // per-frame inline updates below aren't also smoothed by the CSS
    // transition, which would make the cursor-tracking tilt feel laggy.
    card.style.transitionProperty = "border-color, box-shadow";
    axes.scale.target = SCALE_ON_HOVER;
    card.classList.add("is-tilting");
    startLoop();
  });

  card.addEventListener("mouseleave", function () {
    axes.rx.target = 0;
    axes.ry.target = 0;
    axes.scale.target = 1;
    card.classList.remove("is-tilting");
    startLoop();
  });
}

/**
 * Nav language switcher, wired to Google's free client-side "Website
 * Translator" widget (loaded in each page's <body> as
 * #google_translate_element) so picking a language performs a real,
 * live machine translation of the page — not just a label change.
 *
 * How it actually drives translation: Google's widget reads a "googtrans"
 * cookie on page load to decide what to translate the page into. So
 * instead of talking to the hidden widget's internals directly (which is
 * flaky since Google re-renders it), we set that cookie ourselves and
 * reload the page; Google's script then auto-translates on the next load.
 *
 * Requires the page to be served over http(s) — Google's translate
 * service cannot be reached from a local file:// page, and only fully
 * proves out once the site is live on its real domain.
 */
function initLanguageSwitcher() {
  var COOKIE_NAME = "googtrans";
  var SOURCE_LANG = "en";

  // Our menu uses plain ISO codes; Google's cookie/widget expects a couple
  // of these in a more specific form (only Chinese differs here).
  var GOOGLE_CODE_MAP = { zh: "zh-CN" };

  function toGoogleCode(code) {
    return GOOGLE_CODE_MAP[code] || code;
  }

  function fromGoogleCode(googleCode) {
    var match = Object.keys(GOOGLE_CODE_MAP).filter(function (key) {
      return GOOGLE_CODE_MAP[key] === googleCode;
    })[0];
    return match || googleCode;
  }

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeCookie(name, value) {
    var host = window.location.hostname;
    var expires = "; expires=Fri, 31 Dec 9999 23:59:59 GMT";
    var base = name + "=" + value + expires + "; path=/";
    document.cookie = base;
    if (host) {
      document.cookie = base + "; domain=" + host;
      document.cookie = base + "; domain=." + host;
    }
  }

  function clearCookie(name) {
    var host = window.location.hostname;
    var expired = "; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = name + "=" + expired;
    if (host) {
      document.cookie = name + "=" + expired + "; domain=" + host;
      document.cookie = name + "=" + expired + "; domain=." + host;
    }
  }

  function getActiveLangCode() {
    var raw = readCookie(COOKIE_NAME); // format: "/en/de"
    if (!raw) {
      return SOURCE_LANG;
    }
    var parts = raw.split("/");
    var googleCode = parts[2] || parts[1] || SOURCE_LANG;
    return fromGoogleCode(googleCode);
  }

  function applyLangCode(code) {
    if (code === SOURCE_LANG) {
      clearCookie(COOKIE_NAME);
    } else {
      writeCookie(COOKIE_NAME, "/" + SOURCE_LANG + "/" + toGoogleCode(code));
    }
    window.location.reload();
  }

  var switchers = document.querySelectorAll(".lang-switcher");

  switchers.forEach(function (switcher) {
    var button = switcher.querySelector(".lang-switcher-btn");
    var currentLabel = switcher.querySelector(".lang-switcher-current");
    var options = Array.prototype.slice.call(switcher.querySelectorAll(".lang-option"));

    if (!button || !currentLabel || !options.length) {
      return;
    }

    function closeMenu() {
      switcher.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      switcher.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }

    function markSelected(code) {
      options.forEach(function (opt) {
        opt.setAttribute("aria-selected", opt.getAttribute("data-lang-code") === code ? "true" : "false");
      });
      var active = options.filter(function (opt) {
        return opt.getAttribute("data-lang-code") === code;
      })[0];
      var label = active ? active.getAttribute("data-lang-label") : "English";
      currentLabel.textContent = label;
      button.setAttribute("aria-label", "Change language, current language " + label);
    }

    function focusOption(index) {
      var wrapped = ((index % options.length) + options.length) % options.length;
      options[wrapped].focus();
    }

    // Reflect whatever language Google actually translated the page into
    // (read from its cookie) rather than any separately-remembered value,
    // so the button/checkmark can never drift out of sync with reality.
    markSelected(getActiveLangCode());

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      if (switcher.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    button.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
        focusOption(0);
      } else if (event.key === "Escape") {
        closeMenu();
      }
    });

    options.forEach(function (option, index) {
      option.addEventListener("click", function () {
        var code = option.getAttribute("data-lang-code");
        closeMenu();
        if (code === getActiveLangCode()) {
          return;
        }
        applyLangCode(code);
      });

      option.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          option.click();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          focusOption(index + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusOption(index - 1);
        } else if (event.key === "Escape") {
          closeMenu();
          button.focus();
        } else if (event.key === "Tab") {
          closeMenu();
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!switcher.contains(event.target)) {
        closeMenu();
      }
    });
  });
}
