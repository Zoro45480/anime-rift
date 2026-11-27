// Persos MR qui ont leur vidéo d'edit, jouée en plein écran quand ils tombent en invocation.
// Chaque vidéo se trouve dans public/mr-videos/<identifiant>.mp4 (ex. public/mr-videos/naruto.mp4).
export const MR_VIDEOS: string[] = []

// Edits lus directement depuis YouTube (lecteur officiel intégré) : identifiant de la vidéo, début et fin en secondes.
export type YtClip = { id: string; start: number; end: number }
export const MR_YOUTUBE: Record<string, YtClip> = {}
