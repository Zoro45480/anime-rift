import { describe, expect, it } from 'vitest'
import { codeToNo, friendCode } from './online'

describe('code ami', () => {
  it('retrouve le numéro du joueur à partir de son code', () => {
    for (const no of [1, 2, 3, 42, 999, 123456, 9_999_999]) expect(codeToNo(friendCode(no))).toBe(no)
  })
  it('a la forme RIFT-XXXXX et des codes différents pour des joueurs proches', () => {
    expect(friendCode(1)).toMatch(/^RIFT-[A-Z2-9]{5}$/)
    expect(friendCode(1)).not.toBe(friendCode(2))
  })
  it('accepte minuscules, espaces et sans RIFT-, refuse le reste', () => {
    const c = friendCode(77)
    expect(codeToNo(c.toLowerCase())).toBe(77)
    expect(codeToNo(' ' + c.slice(5) + ' ')).toBe(77)
    expect(codeToNo('RIFT-AB')).toBeNull()
    expect(codeToNo('bonjour')).toBeNull()
  })
})
