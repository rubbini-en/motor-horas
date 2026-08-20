/**
 * Configuración por empresa.
 *
 * Cada empresa tiene su propio reglamento interno y el motor lo respeta. Eso
 * significa que el mismo turno, con la misma marcación, puede liquidarse
 * distinto en dos clientes. Es la parte del producto que más caminos genera:
 * acá hay 18 campos; en el sistema real son cientos.
 */

export interface ConfigEmpresa {
  nombre: string

  /** Divisor mensual: jornal = salario del mes / `diasMes`. */
  diasMes: number
  /** Divisor de la hora diurna: valor hora = jornal / `divisorDiurno`. */
  divisorDiurno: number
  /** Divisor de la hora nocturna. La jornada nocturna legal es más corta. */
  divisorNocturno: number

  /** Ventana nocturna, `HH:mm`. Por defecto 20:00 → 06:00. */
  inicioNocturno: string
  finNocturno: string

  /** Atraso tolerado al entrar, en minutos. Es todo o nada (ver README). */
  toleranciaEntradaMinutos: number
  /** Minutos de más al salir que no se computan como extras. También es todo o nada. */
  toleranciaSalidaMinutos: number

  /** Si está en `false`, el intervalo se paga como tiempo trabajado. */
  descontarIntervalo: boolean
  /** Si está en `false`, lo trabajado antes del inicio del turno no se computa. */
  computarAntesDelTurno: boolean

  /** Si está en `false`, lo trabajado de más no se paga (va a `excedente`). */
  pagarExtras: boolean
  /** Tope diario de extras pagables, en minutos. Lo que pasa el tope va a `excedente`. */
  maximoExtrasDiariasMinutos: number

  /** Recargo de las horas ordinarias nocturnas. 0.30 = +30%. */
  recargoNocturno: number
  recargoExtraDiurna: number
  recargoExtraNocturna: number
  recargoFeriado: number

  /**
   * Si está en `true`, el turno que cruza la medianoche se parte en dos y cada
   * tramo se evalúa contra su propia fecha. Si está en `false`, el turno entero
   * se evalúa contra la fecha de inicio.
   */
  dividirTurnoPorMedianoche: boolean

  /** Redondear cada categoría al guaraní. */
  redondearValores: boolean

  /**
   * Adhesión voluntaria a la Resolución 118/2026: para jornadas desde su vigencia,
   * las horas ordinarias nocturnas pasan a pagarse con recargo del 40% (art. 1°).
   * Los no adheridos siguen liquidando con el régimen anterior (art. 5°).
   */
  adherida118: boolean
}

/**
 * Empresa industrial, turnos fijos, reglamento estricto.
 * Es la configuración que usa la mayoría de los tests.
 */
export const FRIGORIFICO: ConfigEmpresa = {
  nombre: 'Frigorífico del Este S.A.',
  diasMes: 30,
  divisorDiurno: 8,
  divisorNocturno: 7,
  inicioNocturno: '20:00',
  finNocturno: '06:00',
  toleranciaEntradaMinutos: 10,
  toleranciaSalidaMinutos: 5,
  descontarIntervalo: true,
  computarAntesDelTurno: false,
  pagarExtras: true,
  maximoExtrasDiariasMinutos: 180,
  recargoNocturno: 0.3,
  recargoExtraDiurna: 0.5,
  recargoExtraNocturna: 1,
  recargoFeriado: 1,
  dividirTurnoPorMedianoche: true,
  redondearValores: true,
  adherida118: false,
}

/**
 * Empresa de seguridad privada: guardias de 12 horas, mucho turno nocturno,
 * reglamento más flexible en la entrada y sin partir el turno por la medianoche
 * (para ellos la guardia es un solo evento, empiece cuando empiece).
 */
export const SEGURIDAD_SUR: ConfigEmpresa = {
  ...FRIGORIFICO,
  nombre: 'Seguridad Sur SRL',
  toleranciaEntradaMinutos: 15,
  toleranciaSalidaMinutos: 10,
  descontarIntervalo: false,
  maximoExtrasDiariasMinutos: 240,
  dividirTurnoPorMedianoche: false,
}

export const EMPRESAS: Record<string, ConfigEmpresa> = {
  frigorifico: FRIGORIFICO,
  seguridad: SEGURIDAD_SUR,
}
