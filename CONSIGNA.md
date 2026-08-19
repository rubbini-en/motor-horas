# Caso práctico · Motor de horas

**Estimación de dos horas de duración.** Elegí vos cuándo hacerlo, dentro de los próximos 5 días.

**Podés usar IA, y queremos que la uses.** Claude, Cursor, Copilot, lo que uses normalmente. Así trabajamos acá todos los días. No estamos evaluando si sabés escribir código de memoria: estamos evaluando tu criterio.

> ### No quiero la solución. Quiero cómo llegaste a la solución.
>
> Es la frase más honesta que te podemos decir sobre este ejercicio. El código que entregues, hoy, lo puede escribir cualquiera con un agente al lado — y está bien, porque acá también lo hacemos así.
>
> Lo que no se puede copiar es **el camino**: dónde arrancaste, qué le preguntaste a la IA, qué te devolvió que no te cerró, en qué momento paraste y dijiste "no, eso está mal".
>
> Entonces: **cuanto más nos muestres de ese camino, mejor te vamos a entender.** Si podés, mandanos el historial de tu conversación con la IA junto con el repo — entero, tal como quedó. No lo miramos para auditarte ni suma por existir: lo miramos porque es la forma más rápida que conocemos de entender cómo pensás, y de que la charla después arranque en serio y no en la presentación.
>
> Un historial editado dice menos que ninguno. Y si preferís no mandarlo, no pasa nada y no restás: contanos lo mismo en la bitácora, con un ejemplo concreto.

**Hay más trabajo del que entra en dos horas. Es a propósito.** Queremos ver qué elegís hacer y qué elegís dejar afuera. Nadie termina todo, y el que lo intenta entrega todo por la mitad.

---

## Las tres tareas

### 1 · Encontrá lo que está mal

La suite de tests pasa entera. Aun así, el motor **no cumple las reglas escritas en el README** en al menos tres situaciones.

Encontralas, explicá **por qué** pasan, y escribí para cada una un test que la exponga.

> El test que falla antes del arreglo vale más que el arreglo.

### 2 · Implementá la Resolución 118/2026

En [`REGLA-NUEVA.md`](REGLA-NUEVA.md) hay una resolución que cambia cómo se pagan ciertas horas. Implementala **sin romper el comportamiento anterior**:

- las empresas que **no** adhirieron siguen liquidando exactamente como antes;
- las jornadas **anteriores** a la fecha de vigencia siguen dando exactamente el mismo resultado que daban.

Cómo modelás la adhesión y la vigencia es decisión tuya.

### 3 · Contanos qué pasó

Completá [`BITACORA.md`](BITACORA.md). Es corto —cuatro preguntas— y es la parte que más leemos.

---

## Si te sobra tiempo

Nada de esto es obligatorio. Está acá para que el alcance sea más grande que las dos horas, que es justamente el punto. Si tocás algo de esto, contalo en la bitácora:

- `calcularJornada` tiene unas 180 líneas. ¿Cómo la partirías? (proponer alcanza, no hace falta hacerlo)
- ¿Qué casos borde no cubre la suite actual?
- ¿Qué combinaciones de `ConfigEmpresa` son incompatibles entre sí, o directamente no tienen sentido?
- `partirEnBloques` recorre minuto por minuto. ¿Cuándo empieza a doler eso de verdad?

---

## Cómo entregar

1. Subí el repositorio a GitHub (público, o privado con acceso) o a un gist.
2. Pegá el link en el formulario, junto con las tres respuestas que ya escribiste en la bitácora.
3. **Opcional, y lo valoramos mucho:** sumá el historial de tu sesión con la IA. Un archivo en el repo, un link compartido, o capturas — como te quede cómodo. Si usás Claude Code, la sesión queda guardada en tu máquina; si usás Cursor, se exporta el chat; si es web, alcanza con un link.
4. Después charlamos **60 minutos** sobre lo que hiciste, con tu pantalla compartida.

**Esa charla es la parte más importante del ejercicio.** Vamos a mirar tu código juntos y te vamos a preguntar por qué. Vas a resolver un requisito nuevo ahí mismo, con tu IA prendida y la pantalla compartida — porque queremos verte trabajar como trabajás, no recitar. Y vas a revisar una entrega ajena de este mismo ejercicio, como si fuera el PR de un compañero. No hay que preparar nada para nada de eso.

---

## Cómo se evalúa

Te lo decimos entero, porque preferimos que optimices para lo que de verdad miramos:

| Qué miramos | Qué es un buen resultado |
|---|---|
| **Lectura de código ajeno** | Encontraste defectos, explicaste la **causa** y escribiste el test que los expone |
| **Razonamiento de dominio** | Entendiste la regla, y si algo estaba ambiguo lo resolviste explícitamente (o preguntaste) |
| **Criterio de alcance** | Cortaste a propósito, explicaste el criterio y dijiste qué harías con más tiempo |
| **Calidad de ingeniería** | Cambio mínimo, retrocompatible, con un test que **prueba** que lo viejo no se movió |
| **Cómo trabajás con IA** ⭐ | Le armás el contexto antes de pedirle código, verificás lo que te devuelve, y sabés decir en qué momento **no** le hiciste caso. Es de lo que más pesa |
| **Defensa en vivo** | Explicás el trade-off, admitís lo que no sabés, cambiás de idea con un argumento nuevo |

> **Una aclaración sobre el peso, para que no la descubras después.** La entrega es la entrada; la charla es la prueba. El repositorio nos sirve para tener de qué hablar y para saber que llegaste — la decisión se toma en los 60 minutos. Por eso no vale la pena inflar la entrega, y sí vale la pena entender cada línea que mandás.

### Lo que **no** evaluamos

- Si terminaste todo. Nadie termina todo.
- La velocidad. Dos horas es un techo, no una meta.
- Si usaste IA. Usala. Lo que miramos es qué hiciste con lo que te devolvió.
- El estilo del código, el formato, o si preferís `for` o `reduce`.
- Si sabés legislación laboral paraguaya. No hace falta: las reglas están todas escritas en el README.

---

## Dos cosas más

**Este código es sintético.** Fue escrito para este ejercicio. No es código de producción de PuntoOK y nada de lo que hagas se usa en nuestro producto.

**Si algo no te cierra, escribinos.** Del enunciado, del README o de la resolución. Preguntar no resta.
