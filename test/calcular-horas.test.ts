import { describe, expect, it } from 'vitest'

import { calcularJornada } from '../src/calcular-horas.js'
import { ConfigEmpresa, FRIGORIFICO, SEGURIDAD_SUR } from '../src/config-empresa.js'
import { Jornada, MotorError } from '../src/tipos.js'

/**
 * Suite del motor de horas.
 *
 * Convención: 2026-10-05 es un lunes común (no feriado) y es el día que usamos
 * para casi todo. Los feriados salen de `src/feriados.ts`.
 *
 * Salario mensual de referencia: 3.000.000 G$ → jornal 100.000 → hora diurna
 * 12.500 G$ (jornal / 8) y hora nocturna 14.285,71 G$ (jornal / 7).
 */

const DIA_COMUN = '2026-10-05'
const FERIADO = '2026-05-01' // Día del Trabajador

const TURNO_ADMINISTRATIVO = {
  nombre: 'Administrativo 08-17',
  inicio: '08:00',
  fin: '17:00',
  intervalo: { inicio: '12:00', fin: '13:00' },
}

const TURNO_VIGILANCIA = {
  nombre: 'Vigilancia corta 20-23',
  inicio: '20:00',
  fin: '23:00',
}

const TURNO_TARDE = {
  nombre: 'Tarde 14-23',
  inicio: '14:00',
  fin: '23:00',
}

function jornada(parcial: {
  fecha?: string
  turno?: Jornada['turno']
  entrada: string
  salida: string
  formaPago?: 'mensual' | 'jornalero'
  salarioBase?: number
}): Jornada {
  const fecha = parcial.fecha ?? DIA_COMUN
  return {
    fecha,
    colaborador: {
      nombre: 'Ramona Benítez',
      formaPago: parcial.formaPago ?? 'mensual',
      salarioBase: parcial.salarioBase ?? 3_000_000,
    },
    turno: parcial.turno ?? TURNO_ADMINISTRATIVO,
    marcacion: {
      entrada: `${fecha}T${parcial.entrada}`,
      salida: `${fecha}T${parcial.salida}`,
    },
  }
}

describe('turno diurno', () => {
  it('marcación exacta: paga la jornada ordinaria completa y descuenta el intervalo', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '17:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.minutos.ordinariasNocturnas).toBe(0)
    expect(r.minutos.extrasDiurnas).toBe(0)
    expect(r.minutos.intervalo).toBe(60)
    expect(r.total).toBe(100_000)
  })

  it('salida temprana: paga solo lo trabajado', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '15:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(360)
    expect(r.minutos.extrasDiurnas).toBe(0)
  })

  it('entrada anticipada: no computa el tiempo previo al inicio del turno', () => {
    const r = calcularJornada(jornada({ entrada: '07:30', salida: '17:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.minutos.descuento).toBe(0)
  })

  it('horas extras diurnas por encima de la jornada', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '19:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.minutos.extrasDiurnas).toBe(120)
    expect(r.total).toBe(137_500) // 100.000 ordinarias + 37.500 de extras al 50%
  })
})

describe('tolerancias', () => {
  it('atraso dentro de la tolerancia: no descuenta y computa desde el inicio del turno', () => {
    const r = calcularJornada(jornada({ entrada: '08:05', salida: '17:00' }))

    expect(r.minutos.descuento).toBe(0)
    expect(r.minutos.ordinariasDiurnas).toBe(480)
  })

  it('atraso fuera de la tolerancia: descuenta el atraso completo', () => {
    const r = calcularJornada(jornada({ entrada: '08:25', salida: '17:00' }))

    expect(r.minutos.descuento).toBe(25)
    expect(r.minutos.ordinariasDiurnas).toBe(455)
    expect(r.total).toBe(94_792)
  })

  it('exceso de salida dentro de la tolerancia: no genera extras', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '17:04' }))

    expect(r.minutos.extrasDiurnas).toBe(0)
    expect(r.minutos.ordinariasDiurnas).toBe(480)
  })
})

describe('nocturnidad', () => {
  it('turno íntegramente nocturno: paga con el divisor nocturno y el recargo del 30%', () => {
    const r = calcularJornada(
      jornada({ turno: TURNO_VIGILANCIA, entrada: '20:00', salida: '23:00' }),
    )

    expect(r.minutos.ordinariasNocturnas).toBe(180)
    expect(r.minutos.ordinariasDiurnas).toBe(0)
    expect(r.total).toBe(55_714) // 3 h × 14.285,71 × 1,30
  })

  it('turno mixto: separa los minutos diurnos de los nocturnos en la frontera de las 20:00', () => {
    const r = calcularJornada(jornada({ turno: TURNO_TARDE, entrada: '14:00', salida: '23:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(360)
    expect(r.minutos.ordinariasNocturnas).toBe(180)
    expect(r.minutos.extrasDiurnas).toBe(0)
    expect(r.minutos.extrasNocturnas).toBe(0)
  })
})

describe('feriados', () => {
  it('día feriado: todo el tiempo trabajado se paga como feriado, al doble', () => {
    const r = calcularJornada(jornada({ fecha: FERIADO, entrada: '08:00', salida: '17:00' }))

    expect(r.esFeriado).toBe(true)
    expect(r.minutos.feriadoDiurno).toBe(480)
    expect(r.minutos.ordinariasDiurnas).toBe(0)
    expect(r.total).toBe(200_000)
  })
})

describe('forma de pago', () => {
  it('jornalero: el salario base ya es el jornal, no se divide por los días del mes', () => {
    const r = calcularJornada(
      jornada({ entrada: '08:00', salida: '17:00', formaPago: 'jornalero', salarioBase: 100_000 }),
    )

    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.total).toBe(100_000)
  })
})

describe('configuración por empresa', () => {
  it('tope diario de extras: lo que pasa el tope no se paga', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '22:00' }))

    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.minutos.extrasDiurnas).toBe(180) // tope de 180 min
    expect(r.minutos.excedente).toBe(120)
  })

  it('empresa que no paga extras: el excedente queda registrado y no se paga', () => {
    const sinExtras: ConfigEmpresa = { ...FRIGORIFICO, pagarExtras: false }
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '19:00' }), sinExtras)

    expect(r.minutos.extrasDiurnas).toBe(0)
    expect(r.minutos.excedente).toBe(120)
    expect(r.total).toBe(100_000)
  })

  it('empresa que no descuenta el intervalo: el descanso se paga como trabajado', () => {
    const r = calcularJornada(jornada({ entrada: '08:00', salida: '17:00' }), SEGURIDAD_SUR)

    expect(r.minutos.intervalo).toBe(0)
    expect(r.minutos.ordinariasDiurnas).toBe(540)
    expect(r.total).toBe(112_500)
  })
})

describe('entradas inválidas', () => {
  it('rechaza una marcación con salida anterior o igual a la entrada', () => {
    expect(() => calcularJornada(jornada({ entrada: '08:00', salida: '08:00' }))).toThrow(MotorError)
  })
})
