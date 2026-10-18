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
  var motionPreview = new URLSearchParams(window.location.search).get("motion-preview") === "1";
  var motionPreferenceQuery = motionPreview ? "all" : "(prefers-reduced-motion: no-preference)";
  var desktopMotionQuery = motionPreview
    ? "(min-width: 1024px)"
    : "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
  var gsapReady = false;

  function refreshMotionLibraries() {
    gsap = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    gsapReady = !!(gsap && ScrollTrigger && /^3\./.test(gsap.version || "") && /^3\./.test(ScrollTrigger.version || ""));
    return gsapReady;
  }

  function setCurrent(items, current) {
    items.forEach(function (item) {
      item.classList.toggle("is-current", item === current);
    });
  }

  function highlightOnRead(items) {
    if (!items.length) return function () {};

    var active = true;
    var scheduled = false;
    function update() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        if (!active) return;

        var viewportCenter = window.innerHeight / 2;
        var nearestDistance = Infinity;
        var current = null;
        items.forEach(function (item) {
          var rect = item.getBoundingClientRect();
          if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
          var distance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenter);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            current = item;
          }
        });

        setCurrent(items, nearestDistance <= window.innerHeight * 0.38 ? current : null);
      });
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return function () {
      active = false;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      setCurrent(items, null);
    };
  }

  function addReadingCues() {
    var cleanups = [
      highlightOnRead(Array.prototype.slice.call(document.querySelectorAll("[data-situation-row]"))),
      highlightOnRead(Array.prototype.slice.call(document.querySelectorAll(".service-row"))),
      highlightOnRead(Array.prototype.slice.call(document.querySelectorAll(".collaboration-line"))),
      highlightOnRead(Array.prototype.slice.call(document.querySelectorAll("[data-timeline-step]")))
    ];

    return function () {
      cleanups.forEach(function (cleanup) { cleanup(); });
    };
  }

  function addTimelineProgress() {
    var progress = document.querySelector("[data-timeline-progress]");
    var timelineList = document.querySelector(".timeline-list");
    if (!progress || !timelineList) return;

    var active = true;
    var scheduled = false;
    progress.style.transform = "scaleY(0)";
    function update() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        if (!active) return;
        var bounds = timelineList.getBoundingClientRect();
        var startLine = window.innerHeight * 0.68;
        var travel = timelineList.offsetHeight + window.innerHeight * 0.26;
        var amount = Math.max(0, Math.min(1, (startLine - bounds.top) / travel));
        progress.style.transform = "scaleY(" + amount + ")";
      });
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return function () {
      active = false;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      progress.style.removeProperty("transform");
    };
  }

  function addOpeningStory() {
    var stage = document.querySelector(".opening-stage");
    var progress = document.querySelector("[data-opening-progress]");
    var count = document.querySelector("[data-opening-count]");
    if (!stage || frames.length !== 3 || !progress || !count) return;

    var deepLink = window.location.hash && window.location.hash !== "#top";
    if (deepLink) return;

    var currentScene = -1;
    var originalScene = stage.getAttribute("data-story-scene");
    root.classList.add("v2-story-active");

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

    var firstExitStart = 0.48;
    var firstEnterStart = 0.57;
    var secondExitStart = 1.35;
    var secondEnterStart = 1.44;
    var transitionDuration = 0.1;
    var firstTransitionEnd = firstExitStart + transitionDuration;
    var secondTransitionEnd = secondExitStart + transitionDuration;

    frames.forEach(function (frame, index) {
      gsap.set(frame, {
        opacity: index === 0 ? 1 : 0,
        yPercent: index === 0 ? 0 : 8
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
          var scrollScreens = width < 700 ? 2.45 : 2.35;
          return "+=" + Math.round(window.innerHeight * scrollScreens);
        },
        pin: stage,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });
    story.to(frames[0], { opacity: 0, yPercent: -7, duration: transitionDuration, ease: "power2.in" }, firstExitStart)
      .fromTo(frames[1], { opacity: 0, yPercent: 8 }, { opacity: 1, yPercent: 0, duration: transitionDuration, ease: "power2.out" }, firstEnterStart)
      .to(progress, { scaleX: 0.5, duration: 0.87, ease: "none" }, 0.48)
      .to(frames[1], { opacity: 0, yPercent: -7, duration: transitionDuration, ease: "power2.in" }, secondExitStart)
      .fromTo(frames[2], { opacity: 0, yPercent: 8 }, { opacity: 1, yPercent: 0, duration: transitionDuration, ease: "power2.out" }, secondEnterStart)
      .to(progress, { scaleX: 1, duration: 0.73, ease: "none" }, 1.35);

    story.eventCallback("onUpdate", function () {
      var storyTime = story.time();
      setScene(
        storyTime < firstTransitionEnd
          ? 0
          : storyTime < secondTransitionEnd ? 1 : 2
      );
    });

    return function () {
      if (story.scrollTrigger) story.scrollTrigger.kill();
      story.kill();
      root.classList.remove("v2-story-active");
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
      count.textContent = "01 / 03";
    };
  }

  function rollback(error) {
    if (matchContext) matchContext.revert();
    ScrollTrigger.getAll().forEach(function (trigger) { trigger.kill(); });
    root.classList.remove("v2-story-active");
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
    if (window.console && console.warn) console.warn("Fosho V2 motion fell back to static content.", error);
  }

  function initialize() {
    if (!refreshMotionLibraries()) {
      if (window.console && console.warn) console.warn("Fosho V2 motion is using static content because GSAP or ScrollTrigger did not load.");
      return false;
    }

    try {
      gsap.registerPlugin(ScrollTrigger);
      matchContext = gsap.matchMedia();

      matchContext.add(motionPreferenceQuery, function () {
        var cleanupStory = addOpeningStory();
        var cleanupCues = addReadingCues();
        return function () {
          if (typeof cleanupCues === "function") cleanupCues();
          if (typeof cleanupStory === "function") cleanupStory();
        };
      });
      matchContext.add(desktopMotionQuery, function () {
        var cleanupProgress = addTimelineProgress();
        return function () {
          if (typeof cleanupProgress === "function") cleanupProgress();
        };
      });

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
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
    if (window.location.hash !== "#top" || root.classList.contains("v2-story-active")) return;
    if (!initialized || !refreshMotionLibraries()) return;

    if (matchContext) matchContext.revert();
    matchContext = null;
    initialized = false;
    runInitialization();
  });
}());
