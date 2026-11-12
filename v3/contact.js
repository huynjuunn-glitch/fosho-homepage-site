(function () {
  'use strict';
  var button = document.querySelector('[data-kakao-float]');
  var contact = document.querySelector('#contact');
  if (!button || !contact) return;

  var scheduled = false;
  function update() {
    scheduled = false;
    // Keep the floating action out of the contact area and the footer below it.
    button.classList.toggle('is-contact-visible', contact.getBoundingClientRect().top <= window.innerHeight * 0.85);
  }
  function scheduleUpdate() {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  update();
}());
