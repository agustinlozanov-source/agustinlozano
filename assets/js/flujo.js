// flujo.js — SCALEx Portal · Hub del Pilar Flujo

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

const VEREDICTO_COLORS = {
  sano: 'verde',
  estresado: 'ambar',
  en_coma: 'rojo'
}

const VEREDICTO_LABELS = {
  sano: 'Negocio Sano',
  estresado: 'Negocio Estresado',
  en_coma: 'Negocio en Coma'
}

const VEREDICTO_ICONOS = {
  sano: 'check-circle',
  estresado: 'alert-triangle',
  en_coma: 'alert-octagon'
}

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await getMyProfile()
  if (!perfil) return
  const org = await getMyOrganization()
  if (!org) return

  const { data: diagnostico, error } = await supabase.rpc('flujo_diagnostico_activo', {
    p_organizacion_id: org.id
  })

  if (error) {
    console.error('❌ flujo_diagnostico_activo:', error.message)
    return
  }

  if (!diagnostico || !diagnostico.veredicto) return

  // Mostrar veredicto en card
  const veredictoEl = document.getElementById('veredicto-diag')
  const badgeEl = document.getElementById('badge-diag')
  const color = VEREDICTO_COLORS[diagnostico.veredicto] || 'ambar'
  const label = VEREDICTO_LABELS[diagnostico.veredicto] || diagnostico.veredicto
  const icono = VEREDICTO_ICONOS[diagnostico.veredicto] || 'activity'

  veredictoEl.innerHTML = `
    <div class="herramienta-veredicto ${color}">
      <i data-lucide="${icono}"></i>
      ${label}
    </div>`
  veredictoEl.style.display = 'block'

  if (badgeEl) {
    badgeEl.textContent = 'Completado'
    badgeEl.className = 'herramienta-badge completado'
  }

  lucide.createIcons()
})
