/**
 * CLI de exploración. No es parte del ejercicio: está para que puedas mirar
 * qué hace el motor sin escribir un test cada vez.
 *
 *   npm run caso
 *   npm run caso -- --fecha 2026-05-01 --turno 22:00-06:00 --entrada 22:00 --salida 06:00
 *   npm run caso -- --empresa seguridad --turno 14:00-23:00 --entrada 14:00 --salida 23:00
 *
 * Opciones: --empresa (frigorifico|seguridad) --fecha --turno HH:mm-HH:mm
 *           --intervalo HH:mm-HH:mm --entrada --salida --salario --forma (mensual|jornalero)
 */

import { calcularJornada, minutosPagados } from './calcular-horas.js'
import { EMPRESAS, FRIGORIFICO } from './config-empresa.js'
import { MINUTOS_POR_DIA, aFecha, aHora, combinar } from './tiempo.js'
import { Jornada, MotorError } from './tipos.js'

function leerArgumentos(argv: string[]): Record<string, string> {
  const opciones: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const actual = argv[i]
    if (actual.startsWith('--')) opciones[actual.slice(2)] = argv[i + 1] ?? ''
  }
  return opciones
}

function partirVentana(valor: string | undefined): { inicio: string; fin: string } | undefined {
  if (!valor) return undefined
  const [inicio, fin] = valor.split('-')
  if (!inicio || !fin) return undefined
  return { inicio, fin }
}

function horas(minutos: number): string {
  const signo = minutos < 0 ? '-' : ''
  const abs = Math.abs(minutos)
  return `${signo}${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`
}

function guaranies(valor: number): string {
  return `${valor.toLocaleString('es-PY')} G$`
}

const o = leerArgumentos(process.argv.slice(2))

const cfg = EMPRESAS[o.empresa ?? 'frigorifico'] ?? FRIGORIFICO
const fecha = o.fecha ?? '2026-10-05'
const turno = partirVentana(o.turno) ?? { inicio: '08:00', fin: '17:00' }
const intervalo = partirVentana(o.intervalo) ?? (o.turno ? undefined : { inicio: '12:00', fin: '13:00' })

const entradaHora = o.entrada ?? turno.inicio
const salidaHora = o.salida ?? turno.fin

const entradaAbs = combinar(fecha, entradaHora)
let salidaAbs = combinar(fecha, salidaHora)
if (salidaAbs <= entradaAbs) salidaAbs += MINUTOS_POR_DIA

const jornada: Jornada = {
  fecha,
  colaborador: {
    nombre: o.nombre ?? 'Colaborador de prueba',
    formaPago: o.forma === 'jornalero' ? 'jornalero' : 'mensual',
    salarioBase: Number(o.salario ?? (o.forma === 'jornalero' ? 100_000 : 3_000_000)),
  },
  turno: { nombre: `${turno.inicio}-${turno.fin}`, inicio: turno.inicio, fin: turno.fin, intervalo },
  marcacion: {
    entrada: `${fecha}T${entradaHora}`,
    salida: `${aFecha(salidaAbs)}T${aHora(salidaAbs)}`,
  },
}

try {
  const r = calcularJornada(jornada, cfg)

  console.log('')
  console.log(`  ${cfg.nombre}  ·  ${r.fecha}${r.esFeriado ? '  ·  FERIADO' : ''}`)
  console.log(`  Turno ${r.turno}${intervalo ? ` (intervalo ${intervalo.inicio}-${intervalo.fin})` : ''}`)
  console.log(`  Marcación ${jornada.marcacion.entrada} → ${jornada.marcacion.salida}`)
  console.log('')

  const filas: Array<[string, number, number | null]> = [
    ['Ordinarias diurnas', r.minutos.ordinariasDiurnas, r.valores.ordinariasDiurnas],
    ['Ordinarias nocturnas', r.minutos.ordinariasNocturnas, r.valores.ordinariasNocturnas],
    ['Extras diurnas', r.minutos.extrasDiurnas, r.valores.extrasDiurnas],
    ['Extras nocturnas', r.minutos.extrasNocturnas, r.valores.extrasNocturnas],
    ['Feriado diurno', r.minutos.feriadoDiurno, r.valores.feriadoDiurno],
    ['Feriado nocturno', r.minutos.feriadoNocturno, r.valores.feriadoNocturno],
    ['Excedente (no pagado)', r.minutos.excedente, null],
    ['Intervalo', r.minutos.intervalo, null],
    ['Descuento por atraso', r.minutos.descuento, null],
  ]

  for (const [etiqueta, minutos, valor] of filas) {
    if (minutos === 0) continue
    const plata = valor === null ? '—' : guaranies(valor)
    console.log(`  ${etiqueta.padEnd(24)} ${horas(minutos).padStart(9)}   ${plata.padStart(14)}`)
  }

  console.log('  ' + '─'.repeat(52))
  console.log(`  ${'TOTAL'.padEnd(24)} ${horas(minutosPagados(r.minutos)).padStart(9)}   ${guaranies(r.total).padStart(14)}`)
  console.log('')
  for (const linea of r.detalle) console.log(`  · ${linea}`)
  console.log('')
} catch (error) {
  if (error instanceof MotorError) {
    console.error(`\n  Error: ${error.message}\n`)
    process.exit(1)
  }
  throw error
}
