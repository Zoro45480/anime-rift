// Images personnelles du joueur pour ses cartes. Elles restent sur SON appareil (base locale du navigateur),
// ne sont envoyées nulle part, et remplacent l'illustration d'origine de la carte.

const DB = 'anime-rift'
const STORE = 'custom-art'

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const run = async <T,>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = work(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const loadAllArt = async (): Promise<Record<string, string>> => {
  try {
    const [keys, values] = await Promise.all([
      run('readonly', (s) => s.getAllKeys()),
      run('readonly', (s) => s.getAll() as IDBRequest<string[]>),
    ])
    return Object.fromEntries(keys.map((k, i) => [String(k), values[i]]))
  } catch {
    return {} // stockage indisponible (navigation privée, etc.) : le jeu fonctionne sans
  }
}

export const saveArt = async (heroId: string, dataUrl: string): Promise<boolean> => {
  try {
    await run('readwrite', (s) => s.put(dataUrl, heroId))
    return true
  } catch {
    return false
  }
}

export const removeArt = async (heroId: string): Promise<void> => {
  try {
    await run('readwrite', (s) => s.delete(heroId))
  } catch {
    /* rien à retirer */
  }
}

// Recadre l'image choisie au format de la carte (5:7) et la compresse.
export const fileToCardImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const W = 600
      const H = 840
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const scale = Math.max(W / img.width, H / img.height)
      const w = img.width * scale
      const h = img.height * scale
      canvas.getContext('2d')!.drawImage(img, (W - w) / 2, (H - h) * 0.25, w, h) // on garde plutôt le haut (les visages)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image illisible'))
    }
    img.src = url
  })
