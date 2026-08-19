/**
 * Feriados.
 *
 * En el sistema real esto viene de la base y se configura por empresa (hay
 * feriados nacionales, departamentales y días no laborables decretados sobre
 * la hora). Acá es una lista fija, que alcanza para el ejercicio.
 */

/** Calendario del ejercicio. Fechas en `YYYY-MM-DD`. */
export const FERIADOS_2026: ReadonlyArray<{ fecha: string; nombre: string }> = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-03-01', nombre: 'Día de los Héroes' },
  { fecha: '2026-04-02', nombre: 'Jueves Santo' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2026-05-14', nombre: 'Independencia Nacional' },
  { fecha: '2026-05-15', nombre: 'Independencia Nacional' },
  { fecha: '2026-06-12', nombre: 'Paz del Chaco' },
  { fecha: '2026-08-15', nombre: 'Fundación de Asunción' },
  { fecha: '2026-09-29', nombre: 'Batalla de Boquerón' },
  { fecha: '2026-12-08', nombre: 'Virgen de Caacupé' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
]

export interface Feriados {
  esFeriado(fecha: string): boolean
  nombre(fecha: string): string | null
}

export function crearFeriados(
  lista: ReadonlyArray<{ fecha: string; nombre: string }> = FERIADOS_2026,
): Feriados {
  const porFecha = new Map(lista.map((f) => [f.fecha, f.nombre]))
  return {
    esFeriado: (fecha) => porFecha.has(fecha),
    nombre: (fecha) => porFecha.get(fecha) ?? null,
  }
}

/** Calendario por defecto, ya armado. */
export const feriados = crearFeriados()
