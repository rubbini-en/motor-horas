# Bitácora

## 1 · Qué hice

Leí el README completo antes de tocar código. Diagnostiqué los 3 defectos a mano, verificando cada uno con un test corrido contra el repo real antes de creerlo. Le pasé ese diagnóstico ya verificado a Claude Code para los tests y los fixes. Diseñé yo la modelización de la Resolución 118/2026 (adhesión + vigencia) antes de pedirle que la implementara.

---

## 2 · Qué recorté del alcance, y por qué

No toqué "si te sobra tiempo" — preferí verificar bien lo pedido antes que tocar algo más superficialmente. Dentro de la Resolución 118, dejé afuera el efecto del art. 3° sobre `extrasNocturnas`: `recargoExtraNocturna` hoy es independiente de `recargoNocturno`, no hay un enganche natural, y prefiero decir "no lo sé" antes que inventar una fórmula. Con tres horas más, empezaría por eso.

---

## 3 · Cómo trabajé con la IA

- **Qué le pedí:** le di los 3 defectos ya diagnosticados y verificados por mí (línea exacta, valores reales de correr los tests), no le pedí que los encontrara — le pedí que escribiera los tests en el estilo de la suite existente, con ese contexto ya armado.
- **En qué momento no le hice caso:** al implementar la Resolución 118, un diff pegado en la terminal parecía duplicar una línea de asignación (dos escrituras seguidas a `val.ordinariasNocturnas`, sin el marcador de línea eliminada que no sobrevive el copiar-pegar). No asumí que era solo un artefacto de formato: abrí el archivo real, confirmé que quedaba una sola línea, y además recalculé a mano (fuera del test) los 3 valores clave de los tests nuevos para no depender tampoco del check verde.
- **Qué no le delego nunca:** si un defecto es real, y el criterio de alcance. Esas decisiones las tomé yo antes de pedirle a la IA que las ejecutara, no al revés.

---

## 4 · Qué parte de mi solución no me da confianza

La interpretación del art. 3° (ver arriba) es la parte más débil — es una lectura razonable que decidí no implementar por no encontrar un enganche defendible, no porque esté seguro de que no aplica. También dudo si el flag `esFeriado` a nivel de jornada (que dejé sin cambiar) es lo que alguien esperaría una vez que el pago real se decide por bloque.

---

## Preguntas o comentarios sobre el ejercicio

El art. 3° de REGLA-NUEVA.md ("el adicional integra la base de cálculo de las horas extraordinarias") admite más de una lectura. Es el único punto donde hubiera preferido preguntar antes de decidir solo.

---

## Extra (opcional, hecho aparte al final)

No era parte de lo pedido, pero después de terminar las 3 tareas me quedó dando vueltas cómo partiría `calcularJornada` si tuviera que tocarla de nuevo — lo dejo como propuesta, sin implementar, tal como dice el enunciado que alcanza:

La función mezcla hoy al menos 4 responsabilidades en ~180 líneas con estado mutable compartido (`tmp`, `aux`, `restanteTope`): resolver tolerancias, aplicar el intervalo, partir en bloques, y repartir el pago por categoría. La separaría en 4 funciones encadenadas — `resolverTolerancias`, `aplicarIntervalo`, `partirEnBloques` (ya existe) y `calcularValoresPorBloque` — dejando `calcularJornada` como un orquestador delgado. El reparto es la que más se beneficiaría de salir sola: es la que tiene la lógica de negocio más densa (feriado vs. ordinaria vs. extra vs. tope) y la que más creció con cada regla nueva — si el art. 3° algún día sí toca `extrasNocturnas`, ese cambio quedaría contenido en una función en vez de tocar el cuerpo entero.