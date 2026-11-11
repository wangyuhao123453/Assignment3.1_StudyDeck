/* =========================================================================
   home.js - image carousel for the home page
   Author: Yuhao Wang (INFO 1012, Assessment 3.1)

   Specification 2.2.1 asks for at least three study-related images plus a
   button that changes or cycles them. Three images are held in the SLIDES
   array; the button advances one step, and the three small dot buttons jump
   straight to an image so the control also works on a touch screen.

   The captions double as alt text alternatives: the image element keeps a
   meaningful alt for screen readers, while the caption tells a sighted user
   what they are looking at without repeating the alt text verbatim.
   ========================================================================= */
(function () {
  'use strict';

  // Each slide has an image path, alt text and a caption shown under the frame.
  var SLIDES = [
    {
      src: 'images/desk-study.jpg',
      alt: 'A desk set up for study: an open notebook with a checklist, a laptop showing a task list, a lamp and a cup of coffee',
      caption: 'A desk ready for a study session'
    },
    {
      src: 'images/planner.jpg',
      alt: 'A weekly wall planner with ticked days, sticky notes, a clock and a progress bar',
      caption: 'A three-week plan, ticked off day by day'
    },
    {
      src: 'images/study-break.jpg',
      alt: 'A stack of books, a mug of hot drink and a pair of headphones on a desk',
      caption: 'Books, headphones and a short break'
    }
  ];

  var imageEl = document.getElementById('slideImage');
  var captionEl = document.getElementById('slideCaption');
  var changeBtn = document.getElementById('changeImageBtn');
  var dots = Array.prototype.slice.call(document.querySelectorAll('.carousel__dots button'));

  // Guard clause: if the page markup ever changes, stop quietly instead of
  // throwing an error that would break the rest of the page.
  if (!imageEl || !captionEl || !changeBtn) {
    return;
  }

  var current = 0;

  /**
   * Render one slide.
   * @param {number} index - any integer, wrapped into the slide range.
   */
  function show(index) {
    // The modulo trick keeps a negative or oversized index inside 0..n-1.
    current = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;
    var slide = SLIDES[current];

    imageEl.src = slide.src;
    imageEl.alt = slide.alt;
    captionEl.textContent = (current + 1) + ' of ' + SLIDES.length + ' \u00b7 ' + slide.caption;

    // Only one dot can be "pressed" at a time, so aria-pressed mirrors state.
    dots.forEach(function (dot, i) {
      dot.setAttribute('aria-pressed', i === current ? 'true' : 'false');
    });
  }

  changeBtn.addEventListener('click', function () {
    show(current + 1);
  });

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var target = parseInt(dot.getAttribute('data-slide'), 10);
      if (!isNaN(target)) {
        show(target);
      }
    });
  });

  // Preload the other two images after the page has loaded, so the first
  // click does not show a half-drawn frame on a slow connection.
  window.addEventListener('load', function () {
    SLIDES.forEach(function (slide) {
      var preload = new Image();
      preload.src = slide.src;
    });
  });

  show(0);
})();
