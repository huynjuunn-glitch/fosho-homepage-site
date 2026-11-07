/* Local GSAP 3 / ScrollTrigger: subtle section entrances; no custom scroll engine. */
(function () {
  'use strict';
  var copyButton = document.querySelector('[data-copy-email]');
  var copyStatus = document.querySelector('#email-copy-status');
  if (copyButton && copyStatus) {
    copyButton.addEventListener('click', async function () {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText('fosho0512@gmail.com');
        copyStatus.textContent = '이메일 주소를 복사했습니다.';
      } catch (error) {
        copyStatus.textContent = '이메일 주소를 선택해 직접 복사해 주세요.';
      }
    });
  }

  // Progressive enhancement is independent of GSAP and the pinned opening.
  // Without JS every service and its detail links remain ordinary HTML.
  function initServiceBrowser() {
    var browser = document.querySelector('[data-service-browser]');
    if (!browser) return;
    var options = browser.querySelector('[data-service-options]');
    var hint = document.querySelector('[data-service-hint]');
    var articles = Array.prototype.slice.call(browser.querySelectorAll('.scope-item'));
    var compact = window.matchMedia('(max-width: 700px)');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var selected = 0;
    var lastSelected = 0;
    var animations = [];
    var items = articles.map(function (article) {
      var heading = article.querySelector('h3');
      var panel = article.querySelector('.scope-body');
      var label = heading.textContent;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'service-tab';
      button.id = article.id + '-tab';
      button.setAttribute('aria-controls', panel.id);
      button.appendChild(document.createTextNode(label));
      var mark = document.createElement('span');
      mark.className = 'service-toggle-mark';
      mark.setAttribute('aria-hidden', 'true');
      button.appendChild(mark);
      return { article: article, heading: heading, panel: panel, button: button, label: label };
    });

    function cancelAnimations() {
      animations.forEach(function (animation) { animation.cancel(); });
      animations = [];
    }

    function refreshOpening() {
      // A compact disclosure changes document height; keep deep links and
      // ScrollTrigger's measurements in sync without reinitializing motion.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    function render(animate) {
      cancelAnimations();
      items.forEach(function (item, index) {
        var active = index === selected;
        item.button.classList.toggle('is-selected', active);
        item.article.classList.toggle('is-active', active);
        item.panel.hidden = compact.matches && !active;
        item.article.inert = !compact.matches && !active;
        if (!compact.matches && !active) item.article.setAttribute('aria-hidden', 'true');
        else item.article.removeAttribute('aria-hidden');
        if (compact.matches) {
          item.button.setAttribute('aria-expanded', String(active));
          item.button.removeAttribute('aria-selected');
          item.button.tabIndex = 0;
        } else {
          item.button.setAttribute('aria-selected', String(active));
          item.button.removeAttribute('aria-expanded');
          item.button.tabIndex = active ? 0 : -1;
        }
      });
      if (animate && selected >= 0 && !reduced.matches && items[selected].panel.animate) {
        var panel = items[selected].panel;
        var keyframes = compact.matches
          ? [{ height: '0px', opacity: 0 }, { height: panel.getBoundingClientRect().height + 'px', opacity: 1 }]
          : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }];
        var animation = panel.animate(keyframes, { duration: 220, easing: 'cubic-bezier(.2,.65,.3,1)' });
        animations.push(animation);
        animation.finished.then(refreshOpening, function () {});
      } else refreshOpening();
    }

    function select(index, animate) {
      selected = index;
      if (index >= 0) lastSelected = index;
      render(animate);
    }

    function hashSelection() {
      var index = items.findIndex(function (item) {
        return window.location.hash === '#' + item.article.id || window.location.hash === '#' + item.panel.id;
      });
      if (index >= 0) select(index, false);
    }

    function layout() {
      var focused = document.activeElement;
      cancelAnimations();
      browser.classList.toggle('is-compact', compact.matches);
      options.hidden = compact.matches;
      if (compact.matches) {
        options.removeAttribute('role');
        options.removeAttribute('aria-label');
        options.removeAttribute('aria-orientation');
      } else {
        options.setAttribute('role', 'tablist');
        options.setAttribute('aria-label', '서비스 선택');
        options.setAttribute('aria-orientation', 'vertical');
        if (selected < 0) selected = lastSelected;
      }
      items.forEach(function (item) {
        if (compact.matches) {
          item.button.removeAttribute('role');
          item.heading.replaceChildren(item.button);
          item.panel.setAttribute('role', 'region');
          item.panel.removeAttribute('tabindex');
        } else {
          item.heading.textContent = item.label;
          options.appendChild(item.button);
          item.button.setAttribute('role', 'tab');
          item.panel.setAttribute('role', 'tabpanel');
          item.panel.tabIndex = 0;
        }
        item.panel.setAttribute('aria-labelledby', item.button.id);
      });
      browser.classList.add('is-enhanced');
      if (hint) hint.hidden = false;
      render(false);
      if (items.some(function (item) { return item.button === focused; })) focused.focus({ preventScroll: true });
    }

    try {
      items.forEach(function (item, index) {
        item.button.addEventListener('click', function () {
          var beforeTop = item.button.getBoundingClientRect().top;
          select(compact.matches && selected === index ? -1 : index, true);
          // Collapsing a preceding disclosure must not leave the clicked
          // heading above the viewport. Keep its title in view while opening.
          if (compact.matches) {
            var correction = item.button.getBoundingClientRect().top - Math.min(beforeTop, window.innerHeight * .25);
            if (window.FoshoScroll) window.FoshoScroll.by(correction);
            else window.scrollBy(0, correction);
          }
        });
        item.button.addEventListener('keydown', function (event) {
          if (compact.matches) return;
          var target = index;
          if (event.key === 'ArrowDown') target = (index + 1) % items.length;
          else if (event.key === 'ArrowUp') target = (index + items.length - 1) % items.length;
          else if (event.key === 'Home') target = 0;
          else if (event.key === 'End') target = items.length - 1;
          else return;
          event.preventDefault();
          select(target, true);
          items[target].button.focus({ preventScroll: true });
        });
      });
      hashSelection();
      layout();
      window.addEventListener('hashchange', hashSelection);
      // Re-clicking an existing hash doesn't fire hashchange. Resolve the
      // selection before the browser performs its native anchor navigation.
      document.addEventListener('click', function (event) {
        var anchor = event.target.closest('a[href^="#service-"]');
        if (!anchor) return;
        var index = items.findIndex(function (item) { return anchor.hash === '#' + item.article.id; });
        if (index >= 0) select(index, false);
      });
      compact.addEventListener('change', layout);
      reduced.addEventListener('change', function () { cancelAnimations(); refreshOpening(); });
    } catch (error) {
      cancelAnimations();
      browser.classList.remove('is-enhanced', 'is-compact');
      options.hidden = true;
      if (hint) hint.hidden = true;
      items.forEach(function (item) {
        item.heading.textContent = item.label;
        item.panel.hidden = false;
        item.article.inert = false;
        item.article.removeAttribute('aria-hidden');
        item.panel.removeAttribute('role');
        item.panel.removeAttribute('tabindex');
        item.panel.removeAttribute('aria-labelledby');
      });
      console.warn('Fosho services remain in their readable static layout.', error);
    }
  }
  initServiceBrowser();

  function initSplitReveal(gsap) {
    var scene = document.querySelector('[data-split-scene]');
    if (!scene) return;
    var title = scene.querySelector('#process-title');
    var top = scene.querySelector('[data-split-top]');
    var bottom = scene.querySelector('[data-split-bottom]');
    if (!title || !top || !bottom) return;
    function syncDirectEntry() {
      scene.classList.toggle('is-split-direct', window.location.hash === '#process');
    }
    syncDirectEntry();
    window.addEventListener('hashchange', syncDirectEntry);
    document.addEventListener('click', function (event) {
      var anchor = event.target.closest('a[href="#process"]');
      if (anchor) scene.classList.add('is-split-direct');
    });
    function updateBounds() {
      scene.style.setProperty('--split-width', title.offsetWidth + 'px');
      scene.style.setProperty('--split-height', title.offsetHeight + 'px');
    }
    var media = gsap.matchMedia();
    try {
      // Like the requested opening, this scroll-controlled scene runs on the
      // normal URL in every viewport. It adds neither a pin nor autoplay.
      media.add({ active: 'all', compact: '(max-width: 700px)' }, function (context) {
        scene.classList.add('is-split-ready');
        updateBounds();
        var distance = context.conditions.compact ? 68 : 55;
        var reveal = gsap.timeline({
          scrollTrigger: {
            trigger: scene,
            start: 'top 76.5%',
            end: 'top 14.5%',
            scrub: true,
            invalidateOnRefresh: true,
            onRefreshInit: updateBounds,
            // After deliberate section navigation, keep the title readable.
            // Returning above the scene restores the normal scroll reveal.
            onLeaveBack: function () { scene.classList.remove('is-split-direct'); }
          }
        });
        reveal.fromTo(top, { xPercent: 0 }, { xPercent: -distance, duration: 1, ease: 'none' }, 0)
          .fromTo(bottom, { xPercent: 0 }, { xPercent: distance, duration: 1, ease: 'none' }, 0)
          .fromTo([top, bottom], { opacity: 1 }, { opacity: 0, duration: .46, ease: 'none' }, .15)
          .fromTo(title, { opacity: 0 }, { opacity: 1, duration: .285, ease: 'power1.out' }, .46);
        // Direct #process entry must land on the already-readable final title.
        reveal.progress(reveal.scrollTrigger.progress);
        return function () {
          scene.classList.remove('is-split-ready');
          scene.style.removeProperty('--split-width');
          scene.style.removeProperty('--split-height');
        };
      });
    } catch (error) {
      media.revert();
      scene.classList.remove('is-split-ready');
      title.style.removeProperty('opacity');
      console.warn('Fosho collaboration heading remains readable without its visual reveal.', error);
    }
  }

  function initBodyReveals(gsap) {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]')).filter(function (node) {
      // The comparison moves as one block; its columns must never double-animate.
      return !node.closest('.plan-comparison, .individual-list, .inquiry-email');
    });
    ['.service-browser', '.plan-comparison'].forEach(function (selector) {
      var node = document.querySelector(selector);
      if (node) nodes.push(node);
    });
    var records = nodes.map(function (node) {
      return { node: node, done: false, tween: null, trigger: null, top: 0 };
    });
    var media = gsap.matchMedia();

    function finish(record) {
      record.done = true;
      if (record.tween) record.tween.kill();
      if (record.trigger) record.trigger.kill();
      record.tween = record.trigger = null;
      gsap.set(record.node, { clearProps: 'transform,opacity' });
      record.node.dataset.bodyReveal = 'done';
    }

    function showDestination(target) {
      if (!target) return;
      var section = target.closest('main > section');
      records.forEach(function (record) {
        if (record.node.contains(target) || (section && section.contains(record.node))) finish(record);
      });
    }

    function showHash() {
      if (!window.location.hash || window.location.hash === '#top') return;
      try { showDestination(document.getElementById(decodeURIComponent(window.location.hash.substring(1)))); }
      catch (error) { /* An invalid hash must not conceal readable HTML. */ }
    }

    try {
      media.add({ active: 'all', compact: '(max-width: 700px)', reduced: '(prefers-reduced-motion: reduce)' }, function (context) {
        var compact = context.conditions.compact;
        var reduced = context.conditions.reduced;
        var distance = reduced ? 8 : compact ? 22 : 36;
        var duration = compact || reduced ? .6 : .75;
        // Read untransformed row positions before arming any of the entrances.
        records.forEach(function (record) { record.top = record.node.getBoundingClientRect().top; });
        records.forEach(function (record) {
          if (record.done || record.top < window.innerHeight * .86 || record.node.contains(document.activeElement)) {
            finish(record);
            return;
          }
          var group = record.node.closest('.concerns, .working-principles, .process-groups');
          var row = !compact && group ? records.filter(function (sibling) {
            return group.contains(sibling.node) && Math.abs(sibling.top - record.top) < 4;
          }) : [];
          var delay = Math.min(.2, Math.max(0, row.indexOf(record)) * .1);
          gsap.set(record.node, { y: distance, opacity: 0 });
          record.node.dataset.bodyReveal = 'pending';
          function play() {
            if (record.done || record.tween) return;
            record.node.dataset.bodyReveal = 'playing';
            record.tween = gsap.to(record.node, {
              y: 0, opacity: 1, duration: duration, delay: delay, ease: 'power2.out',
              onComplete: function () { finish(record); }
            });
          }
          record.trigger = window.ScrollTrigger.create({
            trigger: record.node,
            start: 'top 86%',
            end: 'bottom top',
            onEnter: play,
            // Fast jumps should finish skipped content, never queue it offscreen.
            onLeave: function () { finish(record); },
            onEnterBack: function () { finish(record); }
          });
        });
        showHash();
        return function () {
          records.forEach(function (record) {
            if (record.tween) record.tween.kill();
            if (record.trigger) record.trigger.kill();
            record.tween = record.trigger = null;
            gsap.set(record.node, { clearProps: 'transform,opacity' });
          });
        };
      });
      window.addEventListener('hashchange', showHash);
      document.addEventListener('focusin', function (event) {
        records.forEach(function (record) {
          if (!record.done && record.node.contains(event.target)) finish(record);
        });
      });
      document.addEventListener('click', function (event) {
        var anchor = event.target.closest('a[href^="#"]');
        if (!anchor || anchor.hash === '#top') return;
        try { showDestination(document.getElementById(decodeURIComponent(anchor.hash.substring(1)))); }
        catch (error) { /* Native navigation still handles malformed links. */ }
      });
    } catch (error) {
      media.revert();
      records.forEach(finish);
      console.warn('Fosho body content remains visible without its entrances.', error);
    }
  }

  function init() {
    if (!window.gsap || !window.ScrollTrigger) return;
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    initSplitReveal(gsap);
    initBodyReveals(gsap);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
    }
  }
  function schedulePageMotion() {
    // story.js schedules its pin first. Measure body scenes in the next frame
    // after that pin exists, rather than against the three-frame static flow.
    if (window.requestAnimationFrame) window.requestAnimationFrame(init);
    else window.setTimeout(init, 0);
  }
  if (document.readyState === 'complete') schedulePageMotion();
  else window.addEventListener('load', schedulePageMotion, { once: true });
}());
