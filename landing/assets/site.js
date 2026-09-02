/* SCALEx · comportamiento compartido del sitio (sin dependencias) */
(function () {
  /* Menú móvil */
  var bar = document.getElementById('topbar');
  var btn = bar && bar.querySelector('.nav-toggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var open = bar.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    bar.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () { bar.classList.remove('nav-open'); btn.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* Reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (e) { io.observe(e); });
  }

  /* Subnav: enlace activo según sección visible (solo anclas de la misma página) */
  var links = Array.prototype.slice.call(document.querySelectorAll('.subnav__links a[href^="#"]'));
  var map = {};
  links.forEach(function (a) { var id = a.getAttribute('href').slice(1); var s = id && document.getElementById(id); if (s) map[id] = a; });
  var ids = Object.keys(map);
  if (ids.length && ('IntersectionObserver' in window)) {
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[e.target.id]; if (a) a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-52px 0px -70% 0px', threshold: 0 });
    ids.forEach(function (id) { io2.observe(document.getElementById(id)); });
  }
})();
