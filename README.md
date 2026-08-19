# Motor de horas — caso práctico

Un motor simplificado de cálculo de horas trabajadas, con su suite de tests.

> **La suite pasa entera. El motor calcula mal.**
> Eso no es un accidente del ejercicio: es el ejercicio.

Este es **código sintético**, escrito para esta prueba. No es código de producción de PuntoOK, no sale de nuestro repositorio y nada de lo que hagas acá se usa en nuestro producto.

La consigna completa está en **[`CONSIGNA.md`](CONSIGNA.md)**. Este archivo es el mapa: cómo correrlo, qué hay adentro y cuáles son las reglas del negocio que el motor tiene que cumplir.

---

## Cómo correrlo

Necesitás Node 20 o superior; lo probamos en 22.

```bash
npm install
npm test          # la suite completa
npm run typecheck # tsc --noEmit
```

Hay además un CLI para mirar el motor sin escribir un test cada vez:

```bash
npm run caso
npm run caso -- --turno 14:00-23:00 --entrada 14:00 --salida 23:00
npm run caso -- --fecha 2026-05-01 --turno 22:00-06:00 --entrada 22:00 --salida 06:00
npm run caso -- --empresa seguridad --entrada 08:20 --salida 19:00
```

Opciones: `--empresa` (`frigorifico` | `seguridad`) · `--fecha` · `--turno HH:mm-HH:mm` · `--intervalo HH:mm-HH:mm` · `--entrada` · `--salida` · `--salario` · `--forma` (`mensual` | `jornalero`).

---

## Qué hay adentro

```
src/
  calcular-horas.ts    el motor. Todo pasa acá
  config-empresa.ts    el reglamento de cada empresa (18 campos)
  feriados.ts          calendario de feriados
  tiempo.ts            aritmética de tiempo en minutos absolutos
  tipos.ts             el vocabulario del dominio
  cli.ts               explorador de línea de comandos (no es parte del ejercicio)
test/
  calcular-horas.test.ts   15 tests, todos en verde
REGLA-NUEVA.md         la resolución que hay que implementar (tarea 2)
BITACORA.md            lo que nos entregás por escrito (tarea 3)
```

Unas 900 líneas en total. El archivo que importa es `calcular-horas.ts`.

---

## El dominio en tres minutos

Una **jornada** es un día de trabajo de una persona: el **turno** que tenía programado y la **marcación** real que hizo. El motor cruza las dos cosas y devuelve **minutos por categoría** y **guaraníes por categoría**.

Las categorías son seis pagables — ordinarias diurnas, ordinarias nocturnas, extras diurnas, extras nocturnas, feriado diurno, feriado nocturno — más tres informativas: `intervalo` (descanso no computado), `descuento` (minutos de atraso descontados) y `excedente` (minutos trabajados que el motor decidió no pagar).

La moneda es el guaraní paraguayo (G$). Un salario mensual de referencia son 3.000.000 G$.

---

## Las reglas

Esta sección es el contrato. **El motor tiene que cumplir esto**; si no lo cumple, es un defecto, no una decisión de diseño.

**1 · Ventana nocturna.** Un minuto trabajado dentro de `[inicioNocturno, finNocturno)` es nocturno; fuera de ahí es diurno. Por defecto, `[20:00, 06:00)`. La ventana cruza la medianoche.

**2 · Jornada ordinaria.** Es la duración del turno programado, menos el intervalo si la empresa lo descuenta. El tiempo trabajado la va consumiendo en orden cronológico; lo que sobra son horas extras.

**3 · Tolerancia de entrada — todo o nada.** Si el atraso es **menor o igual** a `toleranciaEntradaMinutos`, no se descuenta nada y la jornada se computa **desde el inicio del turno** (el tiempo se le regala). Si el atraso **supera** la tolerancia, aunque sea por un minuto, se pierde entera: se descuenta el atraso **completo** y la jornada se computa desde la marcación real.

**4 · Tolerancia de salida — todo o nada.** Simétrica a la anterior. Los minutos trabajados después del fin del turno que sean **menores o iguales** a `toleranciaSalidaMinutos` no se computan. Si superan la tolerancia, se computan todos.

**5 · Antes del turno.** Lo trabajado antes del inicio del turno no se computa, salvo que `computarAntesDelTurno` esté activo.

**6 · Intervalo.** Si `descontarIntervalo` está activo, los minutos trabajados dentro de la ventana del intervalo no se computan.

**7 · Feriado.** Los minutos trabajados en un día feriado se pagan como feriado, y en feriado **no** se separan ordinarias de extras: todo el tiempo del día va a las categorías de feriado.
Si el turno cruza la medianoche, quién manda depende de la empresa:

| `dividirTurnoPorMedianoche` | Cómo se resuelve el feriado |
|---|---|
| `true` | Cada tramo se evalúa contra **su propia fecha**: el tramo de antes de las 00:00 contra el día que empezó, el de después contra el día siguiente |
| `false` | El turno entero se evalúa contra la **fecha de inicio del turno** |

**8 · Valor de la hora.** El jornal es `salarioBase / diasMes` para el mensual, y el `salarioBase` tal cual para el jornalero.
La hora diurna vale `jornal / divisorDiurno` (8) y la hora nocturna vale `jornal / divisorNocturno` (7) — la jornada nocturna legal es más corta, así que la hora nocturna vale más.
**El divisor se decide por el bloque que se está pagando, no por el turno:** en un turno mixto, los minutos diurnos se pagan con el divisor diurno y los nocturnos con el nocturno.

**9 · Recargos.** Sobre el valor de la hora del bloque:

| Categoría | Multiplicador |
|---|---|
| Ordinaria diurna | 1 |
| Ordinaria nocturna | 1 + `recargoNocturno` |
| Extra diurna | 1 + `recargoExtraDiurna` |
| Extra nocturna | 1 + `recargoExtraNocturna` |
| Feriado diurno | 1 + `recargoFeriado` |
| Feriado nocturno | 1 + `recargoFeriado` + `recargoNocturno` |

**10 · Tope de extras.** Se pagan hasta `maximoExtrasDiariasMinutos` por día; lo que pasa el tope va a `excedente` y no se paga. Si `pagarExtras` está en `false`, el tope es cero y todas las extras van a `excedente`.

**11 · Redondeo.** Cada categoría se redondea al guaraní. El total es la suma de las categorías ya redondeadas.

---

## Un ejemplo, con números

Turno administrativo 08:00 → 17:00 con intervalo de 12:00 a 13:00, marcación exacta, salario mensual de 3.000.000 G$ en el Frigorífico del Este:

```
jornal      = 3.000.000 / 30 = 100.000 G$
hora diurna = 100.000 / 8    =  12.500 G$

trabajado   = 08:00-12:00 (240 min) + 13:00-17:00 (240 min) = 480 min
ordinarias  = 480 min diurnas → 8 h × 12.500 = 100.000 G$
intervalo   = 60 min (no computados)
```

Y ese mismo turno, un feriado, paga 200.000 G$: mismos 480 minutos, pero todos en la categoría de feriado, al doble.

---

## Dos aclaraciones

**El código de este ejercicio está en español a propósito.** En PuntoOK el código real está en inglés y el producto en español; acá pusimos todo en español para que el vocabulario del dominio no sea una barrera extra en dos horas.

**El motor es fiel al problema real, no a nuestro código.** La forma del problema —tolerancias todo-o-nada, divisores distintos, la medianoche partiendo el mundo en dos, una configuración por empresa que multiplica caminos— es exactamente la que tenemos. La implementación es sintética y mucho más chica: el motor real pasa las 2.000 líneas.

---

## Dudas

Si algo del enunciado o de `REGLA-NUEVA.md` no te cierra, escribinos. Preguntar no resta.
