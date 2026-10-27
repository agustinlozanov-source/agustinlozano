# agustinlozano.com

La página personal de Agustín Lozano. Sitio estático, sin compilación: lo que
está en el repo es lo que se publica.

- **index.html** — la página entera. Estilos embebidos, fuentes de Google
  (Plus Jakarta Sans + Inter) e iconos de Lucide por CDN. No hay CSS ni JS
  propios en archivos aparte.
- **imagenes/**, **logos/** — lo que usa la página.
- **_redirects** — dos reglas, ambas para enlaces viejos del portal de SCALEx.

## Despliegue

Netlify, sitio `agustinlozano`. Empujar a `main` publica.

## Lo que había antes

Este repo alojó todo SCALEx —la landing, el portal y la app— cuando esos
dominios apuntaban a este mismo sitio de Netlify. Después cada uno se mudó a
su propio repo (`scalex-web` y `coaching-system`) y aquí quedaron las carpetas
muertas: `landing/`, `portal/`, `evaluaciones/`, `resultados/`,
`ejercicio-gc/`, `assets/` y 40 reglas de redirección hacia dominios que ya no
llegan acá.

Se borraron el 27 de octubre de 2026. Están en el historial de git si alguna
vez hacen falta: `git show cbe3e58 -- <ruta>`.
