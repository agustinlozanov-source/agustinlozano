// ============================================================================
// SCALEx · Ejercicio GC — Función del facilitador (Netlify, server-side)
// ============================================================================
// Acciones (POST JSON): { token, action: 'synthesize'|'reset', sesion? }
//   - Verifica el token contra FACILITATOR_TOKEN (nunca en el frontend).
//   - synthesize: lee respuestas (service role), llama a Anthropic con la
//     ANTHROPIC_API_KEY (server-side), escribe la síntesis + estado='voting'.
//   - reset: borra respuestas y votos, estado='collecting', sintesis=[].
//
// Variables de entorno a configurar en Netlify (Site settings → Environment):
//   ANTHROPIC_API_KEY          (console.anthropic.com)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Project Settings → API → service_role)
//   FACILITATOR_TOKEN          (una cadena secreta que vos elijas)
// ============================================================================

const SUPABASE_URL = 'https://rlwkbgcxlbzmspffmibw.supabase.co'
const MODEL = 'claude-opus-5'

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
})

function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true })
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' })

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { ok: false, error: 'json' }) }

  const { token, action } = body
  const sesion = body.sesion || 'gobierno-corporativo'

  if (!process.env.FACILITATOR_TOKEN || token !== process.env.FACILITATOR_TOKEN) {
    return json(401, { ok: false, error: 'no_autorizado' })
  }

  try {
    if (action === 'reset') {
      await sb(`gc_respuestas?sesion_id=eq.${sesion}`, { method: 'DELETE' })
      await sb(`gc_votos?sesion_id=eq.${sesion}`, { method: 'DELETE' })
      await sb(`gc_sesiones?id=eq.${sesion}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'collecting', sintesis: [] }),
      })
      return json(200, { ok: true })
    }

    if (action === 'synthesize') {
      const r = await sb(`gc_respuestas?sesion_id=eq.${sesion}&select=nombre,texto&order=creado_en.asc`)
      const respuestas = await r.json()
      if (!Array.isArray(respuestas) || respuestas.length < 2) {
        return json(400, { ok: false, error: 'pocas_respuestas' })
      }
      const defs = respuestas.map((x) => `- ${x.nombre}: "${String(x.texto).replace(/"/g, "'")}"`).join('\n')

      const prompt = `Eres un facilitador experto en estrategia empresarial. Un grupo de directivos y dueños de empresas acaba de escribir sus definiciones personales de "Gobierno Corporativo". Tu trabajo es sintetizar TODAS las respuestas en exactamente 3 opciones de definición que capturen la esencia colectiva.

Las definiciones del grupo son:
${defs}

Reglas:
1. Genera exactamente 3 definiciones alternativas, cada una en 1-2 oraciones máximo.
2. Cada definición debe recoger ideas de múltiples participantes.
3. El tono debe ser directo, pragmático, no académico.
4. No uses jerga legal ni de consultoría.
5. Cada opción debe tener un ángulo ligeramente diferente:
   - Una más operativa (reglas, procesos, orden)
   - Una más estratégica (trascendencia, patrimonio, acceso a capital)
   - Una más visionaria (proteger el legado, escalar al líder)

Usa las etiquetas exactas "Opción A", "Opción B", "Opción C".`

      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          output_config: {
            effort: 'low',
            format: {
              type: 'json_schema',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  opciones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: { label: { type: 'string' }, text: { type: 'string' } },
                      required: ['label', 'text'],
                    },
                  },
                },
                required: ['opciones'],
              },
            },
          },
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await ar.json()
      if (!ar.ok) return json(502, { ok: false, error: 'anthropic', detail: data?.error?.message || data })

      const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
      let parsed
      try { parsed = JSON.parse(text) } catch { return json(502, { ok: false, error: 'parse', raw: text }) }
      let opciones = Array.isArray(parsed) ? parsed : (parsed.opciones || [])
      opciones = opciones
        .filter((o) => o && o.text)
        .slice(0, 3)
        .map((o, i) => ({ label: o.label || `Opción ${'ABC'[i]}`, text: String(o.text).trim() }))
      if (opciones.length < 3) return json(502, { ok: false, error: 'sintesis_incompleta' })

      await sb(`gc_sesiones?id=eq.${sesion}`, {
        method: 'PATCH',
        body: JSON.stringify({ sintesis: opciones, estado: 'voting' }),
      })
      return json(200, { ok: true, opciones })
    }

    return json(400, { ok: false, error: 'accion' })
  } catch (e) {
    return json(500, { ok: false, error: 'servidor', detail: String(e) })
  }
}
