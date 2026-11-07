(function () {
  "use strict";

  var root = document.documentElement;
  var frames = Array.prototype.slice.call(document.querySelectorAll("[data-story-frame]"));
  var gsap = null;
  var ScrollTrigger = null;
  var frameState = frames.map(function (frame) {
    return {
      ariaHidden: frame.getAttribute("aria-hidden"),
      inert: frame.inert,
      pointerEvents: frame.style.pointerEvents
    };
  });
  var interactiveState = frames.map(function (frame) {
    return Array.prototype.slice.call(frame.querySelectorAll("a, button, [role='button']")).map(function (element) {
      return {
        element: element,
        tabindex: element.getAttribute("tabindex"),
        ariaHidden: element.getAttribute("aria-hidden")
      };
    });
  });
  var matchContext = null;
  var openingReachedFromDeepLink = false;
  // The public page should play its designed scroll transitions on the normal URL.
  // Do not gate the opening behind a QA query or a browser preference.
  var motionPreferenceQuery = "all";
  var gsapReady = false;

  function refreshMotionLibraries() {
    gsap = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    gsapReady = !!(gsap && ScrollTrigger && /^3\./.test(gsap.version || "") && /^3\./.test(ScrollTrigger.version || ""));
    return gsapReady;
  }

  function addOpeningStory() {
    var stage = document.querySelector(".opening-stage");
    var progress = document.querySelector("[data-opening-progress]");
    var count = document.querySelector("[data-opening-count]");
    var graphic = stage && stage.querySelector("[data-opening-graphic]");
    if (!stage || frames.length !== 3 || !progress || !count) return;

    var deepLink = window.location.hash && window.location.hash !== "#top";
    if (deepLink && !openingReachedFromDeepLink) return;

    var currentScene = -1;
    var originalScene = stage.getAttribute("data-story-scene");
    root.classList.add("v3-story-active");

    function setScene(index) {
      if (index === currentScene) return;
      var outgoing = currentScene >= 0 ? frames[currentScene] : null;
      var incoming = frames[index];

      if (outgoing && outgoing !== incoming && outgoing.contains(document.activeElement)) {
        var focusTarget = incoming.querySelector("[data-story-focus]") || document.querySelector(".header-cta");
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
        }
      }

      currentScene = index;
      stage.setAttribute("data-story-scene", String(index + 1));
      frames.forEach(function (frame, frameIndex) {
        frame.style.pointerEvents = frameIndex === index ? "auto" : "none";
        if (frameIndex === index) {
          if (frameState[frameIndex].ariaHidden === null) frame.removeAttribute("aria-hidden");
          else frame.setAttribute("aria-hidden", frameState[frameIndex].ariaHidden);
          frame.inert = frameState[frameIndex].inert;
        } else {
          frame.setAttribute("aria-hidden", "true");
          frame.inert = true;
        }
      });
      interactiveState.forEach(function (items, frameIndex) {
        items.forEach(function (state) {
          if (frameIndex === index) {
            if (state.tabindex === null) state.element.removeAttribute("tabindex");
            else state.element.setAttribute("tabindex", state.tabindex);
            if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
            else state.element.setAttribute("aria-hidden", state.ariaHidden);
          } else {
            state.element.setAttribute("tabindex", "-1");
            state.element.setAttribute("aria-hidden", "true");
          }
        });
      });
      count.textContent = "0" + (index + 1) + " / 03";
    }

    // Every scroll interval has visible motion: a readable slow travel followed
    // by a more pronounced exit/entrance. The bar follows the whole pinned run.
    var firstExitStart = 0.48;
    var firstEnterStart = 0.77;
    var secondExitStart = 1.60;
    var secondEnterStart = 1.89;
    var transitionDuration = 0.48;
    var totalDuration = 3;
    // Timings are scroll-timeline coordinates, not seconds. The fades now
    // overlap by about 40%. Longer fades now occupy roughly half a viewport
    // of actual scroll, rather than a short flash between readable scenes.
    function driftDistance() { return Math.min(18, window.innerHeight * 0.025); }
    function entranceDistance() { return Math.max(44, Math.min(64, window.innerHeight * 0.07)); }
    function exitDistance() { return -driftDistance() - entranceDistance(); }

    frames.forEach(function (frame, index) {
      gsap.set(frame, {
        opacity: index === 0 ? 1 : 0,
        y: index === 0 ? 0 : entranceDistance
      });
    });
    setScene(0);
    gsap.set(progress, { scaleX: 0 });

    var story;
    story = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        end: function () {
          var width = window.innerWidth;
          var scrollScreens = width < 700 ? 3.10 : 3.00;
          return "+=" + Math.round(window.innerHeight * scrollScreens);
        },
        pin: stage,
        refreshPriority: 1,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });
    story.to(frames[0], { y: function () { return -driftDistance(); }, duration: firstExitStart, ease: "none" }, 0)
      .to(frames[0], { opacity: 0, y: exitDistance, duration: transitionDuration, ease: "power1.in" }, firstExitStart)
      .fromTo(frames[1], { opacity: 0, y: entranceDistance }, { opacity: 1, y: function () { return driftDistance() * 0.25; }, duration: transitionDuration, ease: "power2.out" }, firstEnterStart)
      .to(frames[1], { y: function () { return -driftDistance(); }, duration: secondExitStart - (firstEnterStart + transitionDuration), ease: "none" }, firstEnterStart + transitionDuration)
      .to(frames[1], { opacity: 0, y: exitDistance, duration: transitionDuration, ease: "power1.in" }, secondExitStart)
      .fromTo(frames[2], { opacity: 0, y: entranceDistance }, { opacity: 1, y: function () { return driftDistance() * 0.25; }, duration: transitionDuration, ease: "power2.out" }, secondEnterStart)
      .to(frames[2], { y: function () { return -driftDistance(); }, duration: totalDuration - (secondEnterStart + transitionDuration), ease: "none" }, secondEnterStart + transitionDuration)
      .to(progress, { scaleX: 1, duration: totalDuration, ease: "none" }, 0);

    // Reuse the existing pinned timeline: no extra scroll distance or trigger.
    if (graphic) {
      story.fromTo(graphic, { xPercent: function () { return window.innerWidth < 700 ? 12 : 18; } }, {
        xPercent: function () { return window.innerWidth < 700 ? -38 : -55; },
        duration: totalDuration,
        ease: "none"
      }, 0);
    }

    story.eventCallback("onUpdate", function () {
      // Follow the visibly dominant sentence in either scroll direction.
      // The old exit-end threshold becomes inaccurate during a crossfade.
      var dominant = 0;
      var opacity = -1;
      frames.forEach(function (frame, index) {
        var value = Number(gsap.getProperty(frame, "opacity"));
        if (value > opacity) { dominant = index; opacity = value; }
      });
      setScene(dominant);
    });

    return function () {
      if (story.scrollTrigger) story.scrollTrigger.kill();
      story.kill();
      root.classList.remove("v3-story-active");
      if (originalScene === null) stage.removeAttribute("data-story-scene");
      else stage.setAttribute("data-story-scene", originalScene);
      frames.forEach(function (frame, index) {
        if (frameState[index].ariaHidden === null) frame.removeAttribute("aria-hidden");
        else frame.setAttribute("aria-hidden", frameState[index].ariaHidden);
        frame.inert = frameState[index].inert;
        frame.style.pointerEvents = frameState[index].pointerEvents;
        frame.style.removeProperty("visibility");
        frame.style.removeProperty("opacity");
        frame.style.removeProperty("transform");
      });
      interactiveState.forEach(function (items) {
        items.forEach(function (state) {
          if (state.tabindex === null) state.element.removeAttribute("tabindex");
          else state.element.setAttribute("tabindex", state.tabindex);
          if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
          else state.element.setAttribute("aria-hidden", state.ariaHidden);
        });
      });
      progress.style.removeProperty("transform");
      if (graphic) graphic.style.removeProperty("transform");
      count.textContent = "01 / 03";
    };
  }

  function rollback(error) {
    if (matchContext) matchContext.revert();
    root.classList.remove("v3-story-active");
    var stage = document.querySelector(".opening-stage");
    if (stage) stage.removeAttribute("data-story-scene");
    frames.forEach(function (frame, index) {
      if (frameState[index].ariaHidden === null) frame.removeAttribute("aria-hidden");
      else frame.setAttribute("aria-hidden", frameState[index].ariaHidden);
      frame.inert = frameState[index].inert;
      frame.style.pointerEvents = frameState[index].pointerEvents;
      frame.style.removeProperty("visibility");
      frame.style.removeProperty("opacity");
      frame.style.removeProperty("transform");
    });
    interactiveState.forEach(function (items) {
      items.forEach(function (state) {
        if (state.tabindex === null) state.element.removeAttribute("tabindex");
        else state.element.setAttribute("tabindex", state.tabindex);
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      });
    });
    document.querySelectorAll(".is-current").forEach(function (node) { node.classList.remove("is-current"); });
    document.querySelectorAll("[data-opening-progress], [data-timeline-progress]").forEach(function (node) {
      node.style.removeProperty("transform");
    });
    if (window.console && console.warn) console.warn("Fosho V3 motion fell back to static content.", error);
  }

  function initialize() {
    if (!refreshMotionLibraries()) {
      if (window.console && console.warn) console.warn("Fosho V3 motion is using static content because GSAP or ScrollTrigger did not load.");
      return false;
    }

    try {
      gsap.registerPlugin(ScrollTrigger);
      matchContext = gsap.matchMedia();

      matchContext.add(motionPreferenceQuery, function () {
        var cleanupStory = addOpeningStory();
        return function () {
          if (typeof cleanupStory === "function") cleanupStory();
        };
      });


      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
      // This pin can be created after body triggers on #top re-entry. Refresh
      // it first so downstream scenes include its existing pin spacing.
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      ScrollTrigger.update();
      return true;
    } catch (error) {
      rollback(error);
      return false;
    }
  }

  var initialized = false;
  var initializationScheduled = false;

  function runInitialization() {
    initializationScheduled = false;
    if (initialized) return;
    initialized = initialize();
  }

  function scheduleInitialization() {
    if (initialized || initializationScheduled) return;
    initializationScheduled = true;
    if (document.readyState !== "complete") {
      window.addEventListener("load", runInitialization, { once: true });
      return;
    }
    if (window.requestAnimationFrame) window.requestAnimationFrame(runInitialization);
    else window.setTimeout(runInitialization, 0);
  }

  if (document.readyState === "complete") scheduleInitialization();
  else window.addEventListener("load", scheduleInitialization, { once: true });

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    if (initialized && ScrollTrigger) ScrollTrigger.refresh();
    else scheduleInitialization();
  });

  window.addEventListener("hashchange", function () {
    if (window.location.hash !== "#top" || root.classList.contains("v3-story-active")) return;
    if (!initialized || !refreshMotionLibraries()) return;

    if (matchContext) matchContext.revert();
    matchContext = null;
    initialized = false;
    runInitialization();
  });

  // Deep links should land at their section without shifting it for a new pin.
  // If the visitor then scrolls back to the top manually, restore the opening
  // just as the #top link does, without requiring a preview query parameter.
  window.addEventListener("scroll", function () {
    if (window.scrollY > 2 || !initialized || root.classList.contains("v3-story-active")) return;
    if (!refreshMotionLibraries()) return;
    openingReachedFromDeepLink = true;
    if (matchContext) matchContext.revert();
    matchContext = null;
    initialized = false;
    runInitialization();
  }, { passive: true });
}());
