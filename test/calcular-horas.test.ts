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

  it('atraso exactamente igual a la tolerancia: se perdona (borde inclusivo)', () => {
    const r = calcularJornada(jornada({ entrada: '08:10', salida: '17:00' }))

    expect(r.minutos.descuento).toBe(0)
    expect(r.minutos.ordinariasDiurnas).toBe(480)
    expect(r.total).toBe(100_000)
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

  it('turno mixto: cada bloque se paga con su propio divisor (8 diurno, 7 nocturno)', () => {
    const r = calcularJornada(jornada({ turno: TURNO_TARDE, entrada: '14:00', salida: '23:00' }))

    // 360 min diurnos × (100.000 / 8 / 60) = 75.000
    expect(r.valores.ordinariasDiurnas).toBe(75_000)
    // 180 min nocturnos × (100.000 / 7 / 60) × 1,30 = 55.714
    expect(r.valores.ordinariasNocturnas).toBe(55_714)
    expect(r.total).toBe(130_714)
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

  it('turno que cruza la medianoche desde un feriado a un día común: cada tramo se evalúa contra su propia fecha', () => {
    const j: Jornada = {
      fecha: FERIADO, // 2026-05-01
      colaborador: { nombre: 'Ramona Benítez', formaPago: 'mensual', salarioBase: 3_000_000 },
      turno: { nombre: 'Madrugada 22-04', inicio: '22:00', fin: '04:00' },
      marcacion: {
        entrada: `${FERIADO}T22:00`,
        salida: '2026-05-02T04:00',
      },
    }
    const r = calcularJornada(j)

    // 22:00 → 24:00 del 2026-05-01 (feriado): 120 min feriado nocturno.
    expect(r.minutos.feriadoNocturno).toBe(120)
    // 00:00 → 04:00 del 2026-05-02 (día común): 240 min ordinarias nocturnas.
    expect(r.minutos.ordinariasNocturnas).toBe(240)
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

describe('resolución 118/2026 · recargo nocturno del 40%', () => {
  const ADHERIDA_118: ConfigEmpresa = { ...FRIGORIFICO, adherida118: true }

  it('empresa no adherida: la vigencia no la alcanza, sigue con el recargo del 30%', () => {
    // Jornada del 2026-10-05 (posterior a la vigencia) pero empresa NO adherida.
    const r = calcularJornada(
      jornada({ fecha: '2026-10-05', turno: TURNO_VIGILANCIA, entrada: '20:00', salida: '23:00' }),
    )

    expect(r.total).toBe(55_714) // 3 h × 14.285,71 × 1,30
  })

  it('empresa adherida, jornada anterior a la vigencia: se liquida con el régimen anterior', () => {
    // Art. 4°: las jornadas anteriores al 2026-10-01 se liquidan sin el nuevo adicional.
    const r = calcularJornada(
      jornada({ fecha: '2026-09-28', turno: TURNO_VIGILANCIA, entrada: '20:00', salida: '23:00' }),
      ADHERIDA_118,
    )

    expect(r.total).toBe(55_714) // sigue con el 30% del régimen anterior
  })

  it('empresa adherida, jornada en vigencia: las ordinarias nocturnas pagan el 40%', () => {
    const r = calcularJornada(
      jornada({ fecha: '2026-10-05', turno: TURNO_VIGILANCIA, entrada: '20:00', salida: '23:00' }),
      ADHERIDA_118,
    )

    expect(r.total).toBe(60_000) // 3 h × 14.285,71 × 1,40
  })

  it('feriado nocturno bajo el régimen adherido: el feriado sigue con el recargo anterior (0,30)', () => {
    // 2026-12-25 (Navidad), posterior a la vigencia. El art. 1° nombra "ordinarias
    // nocturnas": el feriado nocturno queda fuera del alcance de este cambio.
    const r = calcularJornada(
      jornada({ fecha: '2026-12-25', turno: TURNO_VIGILANCIA, entrada: '20:00', salida: '23:00' }),
      ADHERIDA_118,
    )

    expect(r.esFeriado).toBe(true)
    expect(r.minutos.feriadoNocturno).toBe(180)
    // 3 h × 14.285,71 × (1 + 1 + 0,30) = 98.571
    expect(r.total).toBe(98_571)
  })
})

describe('entradas inválidas', () => {
  it('rechaza una marcación con salida anterior o igual a la entrada', () => {
    expect(() => calcularJornada(jornada({ entrada: '08:00', salida: '08:00' }))).toThrow(MotorError)
  })
})
