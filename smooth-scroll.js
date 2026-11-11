/* Lenis 1.3.27, MIT. Native scroll coordinates; one GSAP ticker, no extra RAF loop. */
(function () {
  'use strict';
  var root = document.documentElement;
  var button = document.querySelector('[data-smooth-toggle]');
  var status = document.querySelector('[data-smooth-status]');
  // New defaults ignore legacy auto-off state; an explicit new choice is kept.
  var storageKey = 'fosho-v3-smooth-scroll-v2';
  var choice = 'on';
  var lenis = null;
  var tick = null;
  var navigationFrame = 0;
  var historyTarget = null;
  var focusCleanup = null;
  var gsap = window.gsap;
  var triggers = window.ScrollTrigger;
  if (!window.Lenis || !gsap || !triggers || !button || !status) return;
  try { choice = window.sessionStorage.getItem(storageKey) === 'off' ? 'off' : 'on'; } catch (error) { /* Storage is optional. */ }

  function resize() { if (lenis) lenis.resize(); }

  function destroy() {
    if (navigationFrame) cancelAnimationFrame(navigationFrame);
    navigationFrame = 0;
    historyTarget = null;
    if (tick) gsap.ticker.remove(tick);
    tick = null;
    if (lenis) lenis.destroy();
    lenis = null;
  }

  function configure() {
    destroy();
    var enabled = choice !== 'off';
    if (enabled) {
      try {
        lenis = new window.Lenis({
          autoRaf: false,
          lerp: .14,
          wheelMultiplier: 1,
          smoothWheel: true,
          syncTouch: false,
          anchors: false,
          // The approved site default is on; the footer remains an explicit opt-out.
          respectReducedMotion: false
        });
        lenis.on('scroll', triggers.update);
        tick = function (time) { lenis.raf(time * 1000); };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      } catch (error) {
        destroy();
        console.warn('Fosho smooth scrolling is using native scrolling.', error);
      }
    }
    root.dataset.smoothScroll = lenis ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(!!lenis));
    status.textContent = lenis ? '켜짐' : '꺼짐';
    resize();
  }

  function focusTarget(target) {
    if (focusCleanup) focusCleanup();
    if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,select,textarea')) {
      target.setAttribute('tabindex', '-1');
      focusCleanup = function () {
        target.removeAttribute('tabindex');
        target.removeEventListener('blur', focusCleanup);
        focusCleanup = null;
      };
      target.addEventListener('blur', focusCleanup, { once: true });
    }
    target.focus({ preventScroll: true });
  }

  function navigate(event) {
    if (!lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var anchor = event.target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    var url = new URL(anchor.href, window.location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(url.hash.substring(1))); } catch (error) { return; }
    if (!target) return;
    event.preventDefault();
    var oldURL = location.href;
    if (url.hash !== location.hash) {
      history.replaceState(Object.assign({}, history.state, { foshoV3Scroll: window.scrollY }), '', oldURL);
      history.pushState({ foshoV3Scroll: null }, '', url.href);
      // Preserve the existing hero re-entry, service selection and direct-title handlers.
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: oldURL, newURL: url.href }));
    }
    if (navigationFrame) cancelAnimationFrame(navigationFrame);
    navigationFrame = requestAnimationFrame(function () {
      navigationFrame = 0;
      if (!lenis) { target.scrollIntoView(); return; }
      resize();
      lenis.scrollTo(target, {
        onComplete: function () {
          if (location.href !== url.href) return;
          focusTarget(target);
        }
      });
    });
  }

  function syncHistoryNavigation(event) {
    if (event && event.type === 'popstate') {
      historyTarget = event.state && typeof event.state.foshoV3Scroll === 'number' ? event.state.foshoV3Scroll : null;
    }
    if (navigationFrame) cancelAnimationFrame(navigationFrame);
    navigationFrame = 0;
    if (!lenis) return;
    // Back/forward or an external hash change must cancel the old anchor target.
    lenis.scrollTo(window.scrollY, { immediate: true });
    navigationFrame = requestAnimationFrame(function () {
      navigationFrame = 0;
      if (lenis) lenis.scrollTo(historyTarget === null ? window.scrollY : historyTarget, { immediate: true });
      historyTarget = null;
    });
  }

  function init() {
    configure();
    button.hidden = false;
    button.addEventListener('click', function () {
      choice = lenis ? 'off' : 'on';
      try { window.sessionStorage.setItem(storageKey, choice); } catch (error) { /* Native fallback remains usable. */ }
      configure();
    });
    document.addEventListener('click', navigate);
    window.addEventListener('popstate', syncHistoryNavigation);
    window.addEventListener('hashchange', syncHistoryNavigation);
    window.addEventListener('scroll', function () {
      // Saved coordinates protect an interrupted anchor's previous entry only.
      // Once that entry scrolls again, native history owns its live position.
      if (navigationFrame || historyTarget !== null || !history.state || typeof history.state.foshoV3Scroll !== 'number') return;
      history.replaceState(Object.assign({}, history.state, { foshoV3Scroll: null }), '', location.href);
    }, { passive: true });
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', ' '].indexOf(event.key) < 0) return;
      // Let the browser perform keyboard navigation after stopping wheel inertia.
      historyTarget = null;
      syncHistoryNavigation();
    });
    triggers.addEventListener('refresh', resize);
    window.addEventListener('pageshow', resize);
    window.FoshoScroll = {
      by: function (delta) {
        if (lenis) { resize(); lenis.scrollTo(window.scrollY + delta, { immediate: true }); }
        else window.scrollBy({ top: delta, behavior: 'instant' });
      }
    };
  }
  // story.js creates its pin, then page.js measures body scenes, before Lenis starts.
  if (document.readyState === 'complete') requestAnimationFrame(init);
  else window.addEventListener('load', function () { requestAnimationFrame(init); }, { once: true });
}());
