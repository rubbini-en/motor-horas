/**
 * Aritmética de tiempo del motor.
 *
 * Todo se mide en "minutos absolutos": la cantidad de minutos desde una época
 * fija. Así una fecha con hora es un número entero y las comparaciones son
 * comparaciones de enteros — sin objetos Date dando vueltas por el cálculo.
 *
 * No hay conversión de zona horaria en ningún lado: las cadenas se leen
 * literales, tal cual vienen. En el sistema real esa decisión tiene su historia;
 * acá alcanza con saber que `2026-10-05T08:00` es "las ocho de la mañana del 5".
 */

import { MotorError } from './tipos.js'

export const MINUTOS_POR_DIA = 1440

/** Un intervalo de tiempo, medido en minutos absolutos. Cerrado-abierto: `[desde, hasta)`. */
export interface Rango {
  desde: number
  hasta: number
}

/** `'HH:mm'` → minutos desde la medianoche. `'20:00'` → 1200. */
export function minutosDelDia(hhmm: string): number {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new MotorError(`Hora inválida: "${hhmm}". Se espera HH:mm.`)
  }
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/** `'YYYY-MM-DDTHH:mm'` → minutos absolutos. Los segundos, si vienen, se ignoran. */
export function aAbsolutos(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) {
    throw new MotorError(`Fecha inválida: "${iso}". Se espera YYYY-MM-DDTHH:mm.`)
  }
  const anio = Number(iso.slice(0, 4))
  const mes = Number(iso.slice(5, 7))
  const dia = Number(iso.slice(8, 10))
  const hora = Number(iso.slice(11, 13))
  const minuto = Number(iso.slice(14, 16))

  // Date.UTC(...) da milisegundos de la medianoche de ese día; /60000 → minutos.
  return Math.floor(Date.UTC(anio, mes - 1, dia) / 60000) + hora * 60 + minuto
}

/** `('2026-10-05', '08:00')` → minutos absolutos. */
export function combinar(fecha: string, hhmm: string): number {
  return aAbsolutos(`${fecha}T${hhmm}`)
}

/** Minutos absolutos → `'YYYY-MM-DD'` del día en el que cae ese minuto. */
export function aFecha(absolutos: number): string {
  const inicioDelDia = Math.floor(absolutos / MINUTOS_POR_DIA) * MINUTOS_POR_DIA
  return new Date(inicioDelDia * 60000).toISOString().slice(0, 10)
}

/** Minutos absolutos → `'HH:mm'`. */
export function aHora(absolutos: number): string {
  const enElDia = ((absolutos % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA
  const hh = String(Math.floor(enElDia / 60)).padStart(2, '0')
  const mm = String(enElDia % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Minutos absolutos → `'YYYY-MM-DD HH:mm'`, para logs y mensajes. */
export function formatear(absolutos: number): string {
  return `${aFecha(absolutos)} ${aHora(absolutos)}`
}

/**
 * ¿Este minuto del día cae dentro de la ventana nocturna?
 *
 * La ventana es cerrada-abierta: `[inicio, fin)`. Si `inicio > fin`, la ventana
 * cruza la medianoche (que es el caso normal: 20:00 → 06:00).
 */
export function esMinutoNocturno(minutoDelDia: number, inicio: number, fin: number): boolean {
  if (inicio === fin) return false
  if (inicio < fin) return minutoDelDia >= inicio && minutoDelDia < fin
  return minutoDelDia >= inicio || minutoDelDia < fin
}

/** Le saca a `rango` la parte que se superpone con `ventana`. Devuelve 0, 1 o 2 pedazos. */
export function quitarVentana(rango: Rango, ventana: Rango): Rango[] {
  const solapa = Math.min(rango.hasta, ventana.hasta) > Math.max(rango.desde, ventana.desde)
  if (!solapa) return [rango]

  const pedazos: Rango[] = []
  if (rango.desde < ventana.desde) pedazos.push({ desde: rango.desde, hasta: ventana.desde })
  if (rango.hasta > ventana.hasta) pedazos.push({ desde: ventana.hasta, hasta: rango.hasta })
  return pedazos
}

/** Minutos compartidos entre dos rangos. */
export function minutosEnComun(a: Rango, b: Rango): number {
  return Math.max(0, Math.min(a.hasta, b.hasta) - Math.max(a.desde, b.desde))
}

export function duracion(rango: Rango): number {
  return Math.max(0, rango.hasta - rango.desde)
}
