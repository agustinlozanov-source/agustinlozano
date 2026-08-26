// ============================================================================
// SCALEx · Design System — animaciones compartidas (vanilla, sin dependencias)
// Inyecta el fondo animado, revela elementos al hacer scroll y da un "spotlight"
// a las tarjetas que siguen el cursor. Se carga en todas las páginas del sistema.
// ============================================================================
(function () {
  // 1) Fondo animado (glows teal/índigo + grid)
  if (!document.querySelector('.sx-bg')) {
    const bg = document.createElement('div')
    bg.className = 'sx-bg'
    bg.setAttribute('aria-hidden', 'true')
    bg.innerHTML = '<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="grid"></div>'
    document.body.prepend(bg)
  }

  const ready = (fn) => (document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn))

  ready(() => {
    // 2) Reveal on scroll — cualquier elemento con .sx-reveal
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      : null

    const observeAll = () => {
      document.querySelectorAll('.sx-reveal:not(.in)').forEach((el) => {
        if (io) io.observe(el); else el.classList.add('in')
      })
    }
    observeAll()
    // Re-escanea cuando el contenido cambia (SPAs / render dinámico)
    const mo = new MutationObserver(() => observeAll())
    mo.observe(document.body, { childList: true, subtree: true })

    // 3) Spotlight en tarjetas [data-spotlight]
    document.addEventListener('pointermove', (ev) => {
      const card = ev.target.closest && ev.target.closest('.sx-card[data-spotlight]')
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px')
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px')
    }, { passive: true })
  })
})()
