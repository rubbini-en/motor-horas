/**
 * Motor de cálculo de horas.
 *
 * Entra una jornada (turno programado + marcación real) y salen minutos y
 * guaraníes por categoría. Todas las reglas están descritas en el README.
 *
 * Historial rápido, porque se nota al leer: esto arrancó como un cálculo de
 * turno diurno de oficina y le fueron entrando casos — nocturnidad, feriados,
 * tolerancias, tope de extras, jornaleros — sin que nadie parara a reordenar.
 */

import { ConfigEmpresa, FRIGORIFICO } from './config-empresa.js'
import { Feriados, feriados as calendarioPorDefecto } from './feriados.js'
import {
  MINUTOS_POR_DIA,
  Rango,
  aFecha,
  combinar,
  aAbsolutos,
  duracion,
  esMinutoNocturno,
  formatear,
  minutosDelDia,
  quitarVentana,
} from './tiempo.js'
import {
  Jornada,
  MinutosPorCategoria,
  MotorError,
  ResultadoJornada,
  ValoresPorCategoria,
} from './tipos.js'

/**
 * Fecha de entrada en vigencia de la Resolución 118/2026 (adicional del 40%
 * sobre las horas ordinarias nocturnas). Solo aplica a empresas adheridas.
 * Comparación como string: el formato `YYYY-MM-DD` es lexicográficamente ordenable.
 */
export const VIGENCIA_RESOLUCION_118 = '2026-10-01'

/** Un pedazo homogéneo del tiempo trabajado: o es todo diurno, o es todo nocturno. */
interface Bloque extends Rango {
  nocturno: boolean
  /** Fecha del calendario a la que pertenece el bloque. */
  fecha: string
}

const CERO_MINUTOS: MinutosPorCategoria = {
  ordinariasDiurnas: 0,
  ordinariasNocturnas: 0,
  extrasDiurnas: 0,
  extrasNocturnas: 0,
  feriadoDiurno: 0,
  feriadoNocturno: 0,
  excedente: 0,
  intervalo: 0,
  descuento: 0,
}

const CERO_VALORES: ValoresPorCategoria = {
  ordinariasDiurnas: 0,
  ordinariasNocturnas: 0,
  extrasDiurnas: 0,
  extrasNocturnas: 0,
  feriadoDiurno: 0,
  feriadoNocturno: 0,
}

/**
 * Parte un rango trabajado en bloques homogéneos (diurno / nocturno).
 *
 * Va minuto por minuto. Es más lento que calcular las fronteras a mano, pero
 * es lo que no se equivoca cuando el turno cruza la medianoche, cuando la
 * ventana nocturna está configurada al revés o cuando el turno dura más de un
 * día. Un turno de 24 horas son 1440 vueltas: no es el cuello de botella.
 */
function partirEnBloques(rango: Rango, cfg: ConfigEmpresa): Bloque[] {
  const inicioNoche = minutosDelDia(cfg.inicioNocturno)
  const finNoche = minutosDelDia(cfg.finNocturno)
  const bloques: Bloque[] = []

  for (let m = rango.desde; m < rango.hasta; m++) {
    const minutoDelDia = ((m % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA
    const nocturno = esMinutoNocturno(minutoDelDia, inicioNoche, finNoche)
    const fecha = aFecha(m)

    const ultimo = bloques[bloques.length - 1]
    const sigueElMismoBloque =
      ultimo !== undefined &&
      ultimo.nocturno === nocturno &&
      (cfg.dividirTurnoPorMedianoche ? ultimo.fecha === fecha : true)

    if (sigueElMismoBloque) {
      ultimo.hasta = m + 1
    } else {
      bloques.push({ desde: m, hasta: m + 1, nocturno, fecha })
    }
  }

  return bloques
}

/** Redondea (o no) cada categoría, según la configuración de la empresa. */
function cerrarValores(valores: ValoresPorCategoria, cfg: ConfigEmpresa): ValoresPorCategoria {
  if (!cfg.redondearValores) return valores
  const salida = { ...valores }
  for (const clave of Object.keys(salida) as Array<keyof ValoresPorCategoria>) {
    salida[clave] = Math.round(salida[clave])
  }
  return salida
}

function sumar(valores: ValoresPorCategoria): number {
  return Object.values(valores).reduce((a, b) => a + b, 0)
}

/**
 * Calcula una jornada.
 *
 * @param jornada     turno programado + marcación real del colaborador
 * @param cfg         reglamento de la empresa
 * @param calendario  feriados aplicables
 */
export function calcularJornada(
  jornada: Jornada,
  cfg: ConfigEmpresa = FRIGORIFICO,
  calendario: Feriados = calendarioPorDefecto,
): ResultadoJornada {
  const detalle: string[] = []
  const min: MinutosPorCategoria = { ...CERO_MINUTOS }
  const val: ValoresPorCategoria = { ...CERO_VALORES }

  const entrada = aAbsolutos(jornada.marcacion.entrada)
  const salida = aAbsolutos(jornada.marcacion.salida)
  if (salida <= entrada) {
    throw new MotorError(
      `La salida (${jornada.marcacion.salida}) tiene que ser posterior a la entrada (${jornada.marcacion.entrada}).`,
    )
  }

  const inicioTurno = combinar(jornada.fecha, jornada.turno.inicio)
  let finTurno = combinar(jornada.fecha, jornada.turno.fin)
  if (finTurno <= inicioTurno) finTurno += MINUTOS_POR_DIA // el turno cruza la medianoche

  // ------------------------------------------------------------------
  // 1) Tolerancia de entrada. Es todo o nada: si el atraso entra en la
  //    tolerancia se computa desde el inicio del turno como si hubiera
  //    llegado en hora; si se pasa, se descuenta el atraso completo.
  // ------------------------------------------------------------------
  let tmp = entrada
  const atraso = entrada - inicioTurno

  if (atraso > 0) {
    if (atraso <= cfg.toleranciaEntradaMinutos) {
      tmp = inicioTurno
      detalle.push(`Atraso de ${atraso} min dentro de la tolerancia (${cfg.toleranciaEntradaMinutos} min).`)
    } else {
      min.descuento = atraso
      detalle.push(`Atraso de ${atraso} min: se pierde la tolerancia y se descuenta completo.`)
    }
  } else if (atraso < 0 && !cfg.computarAntesDelTurno) {
    tmp = inicioTurno
    detalle.push(`Entró ${-atraso} min antes; no se computa el tiempo previo al turno.`)
  }

  const inicioComputado = tmp

  // ------------------------------------------------------------------
  // 2) Tolerancia de salida. Los minutos de más que no la superan no se
  //    pagan como extras (también todo o nada).
  // ------------------------------------------------------------------
  let finComputado = salida
  const exceso = salida - finTurno
  if (exceso > 0 && exceso <= cfg.toleranciaSalidaMinutos) {
    finComputado = finTurno
    detalle.push(`Salió ${exceso} min después: dentro de la tolerancia de salida, no genera extras.`)
  }

  if (finComputado <= inicioComputado) {
    detalle.push('No quedó tiempo computable en la jornada.')
    return {
      fecha: jornada.fecha,
      colaborador: jornada.colaborador.nombre,
      turno: jornada.turno.nombre,
      esFeriado: calendario.esFeriado(jornada.fecha),
      minutos: min,
      valores: cerrarValores(val, cfg),
      total: 0,
      detalle,
    }
  }

  // ------------------------------------------------------------------
  // 3) Intervalo. Si la empresa lo descuenta, los minutos trabajados que
  //    caen dentro de la ventana de descanso no se computan.
  // ------------------------------------------------------------------
  let tramos: Rango[] = [{ desde: inicioComputado, hasta: finComputado }]
  let minutosDeIntervalo = 0

  if (cfg.descontarIntervalo && jornada.turno.intervalo) {
    const desdeIntervalo = combinar(jornada.fecha, jornada.turno.intervalo.inicio)
    let hastaIntervalo = combinar(jornada.fecha, jornada.turno.intervalo.fin)
    if (hastaIntervalo <= desdeIntervalo) hastaIntervalo += MINUTOS_POR_DIA

    const ventana: Rango = { desde: desdeIntervalo, hasta: hastaIntervalo }
    const nuevos: Rango[] = []
    for (const t of tramos) {
      const pedazos = quitarVentana(t, ventana)
      minutosDeIntervalo += duracion(t) - pedazos.reduce((a, p) => a + duracion(p), 0)
      nuevos.push(...pedazos)
    }
    tramos = nuevos
    if (minutosDeIntervalo > 0) detalle.push(`Se descuentan ${minutosDeIntervalo} min de intervalo.`)
  }

  min.intervalo = minutosDeIntervalo

  // ------------------------------------------------------------------
  // 4) Bloques diurnos / nocturnos.
  // ------------------------------------------------------------------
  const bloques: Bloque[] = []
  for (const t of tramos) bloques.push(...partirEnBloques(t, cfg))

  // ------------------------------------------------------------------
  // 5) Feriado.
  // ------------------------------------------------------------------
  const esFeriado = calendario.esFeriado(jornada.fecha)
  if (esFeriado) {
    detalle.push(`${jornada.fecha} es feriado (${calendario.nombre(jornada.fecha)}).`)
  }

  // ------------------------------------------------------------------
  // 6) Valor de la hora.
  //    El divisor legal de la jornada: 8 para la diurna, 7 para la nocturna.
  // ------------------------------------------------------------------
  const jornal =
    jornada.colaborador.formaPago === 'mensual'
      ? jornada.colaborador.salarioBase / cfg.diasMes
      : jornada.colaborador.salarioBase

  const valorMinutoDiurno = jornal / cfg.divisorDiurno / 60
  const valorMinutoNocturno = jornal / cfg.divisorNocturno / 60

  detalle.push(
    `Jornal ${Math.round(jornal)} G$ · valor minuto diurno ${valorMinutoDiurno.toFixed(2)} G$ · nocturno ${valorMinutoNocturno.toFixed(2)} G$.`,
  )

  // ------------------------------------------------------------------
  // 7) Reparto. Los bloques se van comiendo la jornada ordinaria en orden;
  //    lo que sobra es extra, hasta el tope diario.
  // ------------------------------------------------------------------
  let aux = finTurno - inicioTurno
  if (cfg.descontarIntervalo && jornada.turno.intervalo) {
    const di = combinar(jornada.fecha, jornada.turno.intervalo.inicio)
    let hi = combinar(jornada.fecha, jornada.turno.intervalo.fin)
    if (hi <= di) hi += MINUTOS_POR_DIA
    aux -= hi - di
  }

  let restanteTope = cfg.pagarExtras ? cfg.maximoExtrasDiariasMinutos : 0

  for (const b of bloques) {
    let restante = duracion(b)
    if (restante <= 0) continue

    const valorMinuto = b.nocturno ? valorMinutoNocturno : valorMinutoDiurno
    // Regla 7: si la empresa parte el turno por la medianoche, cada bloque se evalúa
    // contra su propia fecha; si no, todo el turno se evalúa contra la fecha de inicio.
    const bloqueEsFeriado = cfg.dividirTurnoPorMedianoche
      ? calendario.esFeriado(b.fecha)
      : esFeriado

    if (bloqueEsFeriado) {
      // En feriado no se separan ordinarias de extras: todo el tiempo del día
      // se paga como feriado, con el recargo del feriado. Pero igual consume la
      // ordinaria programada: lo que quede fuera del turno programado, en bloques
      // posteriores no feriado, cae en extras como corresponde.
      const consumido = aux > 0 ? Math.min(restante, aux) : 0
      aux -= consumido
      if (b.nocturno) {
        min.feriadoNocturno += restante
        val.feriadoNocturno += restante * valorMinuto * (1 + cfg.recargoFeriado + cfg.recargoNocturno)
      } else {
        min.feriadoDiurno += restante
        val.feriadoDiurno += restante * valorMinuto * (1 + cfg.recargoFeriado)
      }
      continue
    }

    const ordinarias = aux > 0 ? Math.min(restante, aux) : 0
    if (ordinarias > 0) {
      aux -= ordinarias
      restante -= ordinarias
      if (b.nocturno) {
        // Resolución 118/2026, art. 1°: para empresas adheridas y desde la vigencia,
        // el recargo de las ordinarias nocturnas pasa del 30% al 40%.
        const recargoNocturnoVigente =
          cfg.adherida118 && jornada.fecha >= VIGENCIA_RESOLUCION_118 ? 0.4 : cfg.recargoNocturno
        min.ordinariasNocturnas += ordinarias
        val.ordinariasNocturnas += ordinarias * valorMinuto * (1 + recargoNocturnoVigente)
      } else {
        min.ordinariasDiurnas += ordinarias
        val.ordinariasDiurnas += ordinarias * valorMinuto
      }
    }

    if (restante > 0) {
      // Las horas extraordinarias se pagan siempre con el 50% de recargo.
      // Nota: el art. 3° de la Resolución 118/2026 dice que el adicional del art. 1°
      // "integra la base de cálculo" de las extras, pero `recargoExtraNocturna` es una
      // constante independiente de `recargoNocturno` — no hay hoja donde enganchar el
      // nuevo adicional sin inventar estructura. Recorte de alcance deliberado.
      const extras = Math.min(restante, restanteTope)
      const sobra = restante - extras
      restanteTope -= extras

      if (extras > 0) {
        if (b.nocturno) {
          min.extrasNocturnas += extras
          val.extrasNocturnas += extras * valorMinuto * (1 + cfg.recargoExtraNocturna)
        } else {
          min.extrasDiurnas += extras
          val.extrasDiurnas += extras * valorMinuto * (1 + cfg.recargoExtraDiurna)
        }
      }

      if (sobra > 0) {
        min.excedente += sobra
        detalle.push(
          `${sobra} min trabajados quedaron sin pagar (${cfg.pagarExtras ? 'tope de extras' : 'extras deshabilitadas'}).`,
        )
      }
    }
  }

  const valores = cerrarValores(val, cfg)

  detalle.push(
    `Computado ${formatear(inicioComputado)} → ${formatear(finComputado)} en ${bloques.length} bloque(s).`,
  )

  return {
    fecha: jornada.fecha,
    colaborador: jornada.colaborador.nombre,
    turno: jornada.turno.nombre,
    esFeriado,
    minutos: min,
    valores,
    total: sumar(valores),
    detalle,
  }
}

/** Suma de minutos efectivamente pagados (todo menos excedente, intervalo y descuento). */
export function minutosPagados(m: MinutosPorCategoria): number {
  return (
    m.ordinariasDiurnas +
    m.ordinariasNocturnas +
    m.extrasDiurnas +
    m.extrasNocturnas +
    m.feriadoDiurno +
    m.feriadoNocturno
  )
}
