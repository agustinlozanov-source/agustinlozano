# SCALEx - Costeo - Pagina 1: Gastos Fijos

Primera pagina de la herramienta de costeo. Permite capturar
los gastos fijos mensuales de la organizacion + calcular
automaticamente el prorrateo por unidad estimada.

---

## Archivos en este bloque

```
agustinlozano.com/
|
+-- portal/
|   +-- costeo-gastos.html        <- NUEVO
|
+-- assets/
    +-- js/
        +-- costeo-gastos.js      <- NUEVO
```

---

## Pasos de integracion

### 1. Pega los 2 archivos en sus rutas
- `portal/costeo-gastos.html`
- `assets/js/costeo-gastos.js`

### 2. Push a Netlify

```bash
git add portal/costeo-gastos.html assets/js/costeo-gastos.js
git commit -m "feat: pagina de gastos fijos (Bloque G - costeo)"
git push
```

### 3. Probar

Ve a `https://agustinlozano.com/portal/costeo-gastos.html`

---

## Como funciona

### Carga inicial
1. Auth guard valida sesion (te redirige al login si no estas)
2. Carga perfil + org activa
3. Busca el registro de `gastos_fijos_costeo` para esa org
4. Si no existe: lo crea con 7 conceptos default vacios
5. Si existe pero esta vacio: muestra los 7 defaults para que llenes

### Edicion en vivo
- Cada concepto tiene: icono auto (segun texto) + nombre + monto
- Total se calcula al instante
- Prorrateo por unidad se actualiza al instante
- Auto-save con debounce de 1.2 segundos
- Indicador en topbar: Editando -> Guardando -> Guardado

### Conceptos default sugeridos
1. Renta del local
2. Nomina total
3. Energia electrica
4. Gas
5. Agua
6. Internet y telefonia
7. Software y suscripciones

Puedes editar nombres, agregar, eliminar. El JSON en BD se construye dinamicamente.

### Iconos automaticos
El icono cambia segun palabras clave en el nombre:
- "renta", "local", "alquiler" -> edificio
- "nomina", "sueldo", "personal" -> personas
- "energia", "luz", "electricidad" -> rayo
- "gas" -> flama
- "agua" -> gota
- "internet", "telefono" -> wifi
- "software", "suscripcion" -> monitor
- ... y mas

### Prorrateo por unidad
La logica que decidiste:
- Total gastos fijos / Unidades estimadas / mes = Costo fijo por unidad
- Cada producto que se cuestee absorbera este monto

Ejemplo:
- Tienes $70,000 / mes de gastos fijos
- Estimas vender 800 unidades / mes
- Cada producto carga $87.50 de gastos fijos

---

## Troubleshooting

### "No veo nada al cargar"
- Abre DevTools (F12) -> Console
- Si hay error de import: verifica que `supabase-client.js` este en `/assets/js/`
- Si hay error de auth: verifica tu sesion

### "Editando... no pasa a Guardado"
- Verifica conexion a Supabase
- Console te mostrara el error si la RLS bloquea

### "Error al guardar"
- Verifica que tu user sea dueno, consultor o admin de la org
- Si eres miembro normal, solo puedes leer (es por diseno)

### "El total no se actualiza"
- Verifica que el campo monto solo tenga numeros (puede tener comas como separador)
- Console mostrara warning si hay valores no numericos

---

## Verificacion en BD

Despues de llenar y guardar:

```sql
select organizacion_id, conceptos, unidades_estimadas_mes
from gastos_fijos_costeo;
```

Deberias ver tus conceptos como JSONB:
```json
{
  "Renta del local": 18000,
  "Nomina total": 42500,
  ...
}
```

---

## Lista de verificacion

- [ ] `portal/costeo-gastos.html` en su lugar
- [ ] `assets/js/costeo-gastos.js` en su lugar
- [ ] Push y deploy en Netlify
- [ ] Login OK
- [ ] Sidebar: aparece icono calculator activo
- [ ] Pagina carga sin errores en Console
- [ ] Aparecen los 7 conceptos default vacios
- [ ] Escribes un monto -> indicador pasa a "Editando" -> "Guardando" -> "Guardado"
- [ ] Total mensual se actualiza al instante
- [ ] Costo fijo por unidad se actualiza al instante
- [ ] Cambias "Unidades estimadas" -> prorrateo se ajusta
- [ ] Agregas concepto nuevo -> aparece con focus en el nombre
- [ ] Eliminas concepto -> se va y se guarda
- [ ] Recargas pagina -> todo lo que guardaste sigue ahi
- [ ] Cambias tema dark/light -> se mantiene visual

Cuando todo OK, avisas y vamos por la siguiente pagina: Recursos (catalogo).
