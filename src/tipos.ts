/**
 * Tipos del motor de horas.
 *
 * Todo el vocabulario del ejercicio vive acá. Si algo no se entiende, la
 * definición formal de cada regla está en el README, sección "Las reglas".
 */

/** Cómo se le paga al colaborador. Cambia la fórmula de la base. */
export type FormaPago = 'mensual' | 'jornalero'

/** Marcación real del colaborador. Fechas en `YYYY-MM-DDTHH:mm` (sin zona). */
export interface Marcacion {
  entrada: string
  salida: string
}

/** Ventana horaria dentro del día, en `HH:mm`. */
export interface VentanaHoraria {
  inicio: string
  fin: string
}

/**
 * Turno programado. Si `fin` es menor o igual que `inicio`, el turno cruza
 * la medianoche (ej.: 22:00 → 06:00).
 */
export interface Turno {
  nombre: string
  inicio: string
  fin: string
  /** Descanso/almuerzo. Si la empresa lo descuenta, este tiempo no se computa. */
  intervalo?: VentanaHoraria
}

export interface Colaborador {
  nombre: string
  formaPago: FormaPago
  /** Mensual: el salario del mes. Jornalero: el valor del jornal diario. */
  salarioBase: number
}

/** Un día de trabajo de una persona: lo que se le pidió y lo que hizo. */
export interface Jornada {
  /** Día al que pertenece el turno, `YYYY-MM-DD`. */
  fecha: string
  colaborador: Colaborador
  turno: Turno
  marcacion: Marcacion
}

/**
 * Minutos por categoría. Es el corazón del resultado: la plata sale de acá.
 *
 * `excedente` = minutos trabajados que el motor decidió no pagar (tope de
 * extras alcanzado, o extras deshabilitadas en la configuración).
 * `intervalo` = minutos no computados por caer dentro del descanso.
 * `descuento` = minutos de atraso descontados por haber perdido la tolerancia.
 */
export interface MinutosPorCategoria {
  ordinariasDiurnas: number
  ordinariasNocturnas: number
  extrasDiurnas: number
  extrasNocturnas: number
  feriadoDiurno: number
  feriadoNocturno: number
  excedente: number
  intervalo: number
  descuento: number
}

/** Guaraníes por categoría. Mismas claves pagables que `MinutosPorCategoria`. */
export interface ValoresPorCategoria {
  ordinariasDiurnas: number
  ordinariasNocturnas: number
  extrasDiurnas: number
  extrasNocturnas: number
  feriadoDiurno: number
  feriadoNocturno: number
}

export interface ResultadoJornada {
  fecha: string
  colaborador: string
  turno: string
  esFeriado: boolean
  minutos: MinutosPorCategoria
  valores: ValoresPorCategoria
  /** Suma de `valores`. */
  total: number
  /** Traza legible de lo que fue decidiendo el motor. La usa el CLI. */
  detalle: string[]
}

/** Error de entrada del motor (marcación imposible, turno mal armado, etc.). */
export class MotorError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'MotorError'
  }
}
