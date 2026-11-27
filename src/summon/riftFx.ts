// Effets de l'écran d'invocation « faille » : ciel WebGL, faille WebGL, éclats de verre, cristaux, explosion MR,
// particules aspirées et braises. Tout est dessiné par le code (aucune vidéo).

export type RGB = [number, number, number]
type Ctx = CanvasRenderingContext2D

// Couleur de chaque rareté (rang 0 = N … 5 = MR).
export const RARITY_RGB: RGB[] = [[170, 176, 186], [214, 140, 74], [80, 160, 255], [245, 194, 66], [255, 110, 220], [255, 90, 40]]
export const rgb = (c: RGB) => c.join(',')

/* ================= WebGL ================= */
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const NOISE = `precision highp float;uniform vec2 res;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}`

export type Gl = { gl: WebGLRenderingContext; set: (k: string, ...v: number[]) => void; draw: () => void }

const glc = (cv: HTMLCanvasElement, fs: string): Gl | null => {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
  if (!gl) return null
  const sh = (type: number, src: string) => { const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o); return o }
  const pr = gl.createProgram()!
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, NOISE + fs)); gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null
  gl.useProgram(pr)
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0)
  const locs: Record<string, WebGLUniformLocation | null> = {}
  const set = (k: string, ...v: number[]) => {
    const u = k in locs ? locs[k] : (locs[k] = gl.getUniformLocation(pr, k))
    if (v.length === 1) gl.uniform1f(u, v[0]); else if (v.length === 2) gl.uniform2f(u, v[0], v[1]); else gl.uniform3f(u, v[0], v[1], v[2])
  }
  const draw = () => {
    const d = Math.min(devicePixelRatio || 1, 2), w = (cv.clientWidth * d) | 0, hh = (cv.clientHeight * d) | 0
    if (!w || !hh) return
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh }
    gl.viewport(0, 0, w, hh); set('res', w, hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  return { gl, set, draw }
}

// Ciel : l'image de fond avec profondeur (les nuages proches suivent plus la souris), ondulation, étoiles et lueur violette du bas.
export const makeSky = (cv: HTMLCanvasElement, src: string): Gl | null => {
  const sky = glc(cv, `uniform float glow;uniform vec2 mo,isz;uniform sampler2D tex;
vec3 samp(vec2 uv){return texture2D(tex,clamp(uv,.001,.999)).rgb;}
void main(){vec2 uv=gl_FragCoord.xy/res;uv.y=1.-uv.y;
 float ra=res.x/res.y,ia=isz.x/isz.y;vec2 c=uv-.5;if(ra>ia)c.y*=ia/ra;else c.x*=ra/ia;
 c/=1.07+.012*sin(t*.08);vec2 u=c+.5;
 vec3 b0=samp(u);float lum=dot(b0,vec3(.3,.5,.2));float depth=smoothstep(.04,.35,lum)+smoothstep(.35,1.,1.-uv.y)*.4;
 vec2 par=mo*vec2(.018,-.012)*(.25+depth);
 vec2 w=vec2(fbm(u*3.+vec2(t*.03,0.)),fbm(u*3.+vec2(0.,t*.03)+5.))-.5;
 vec2 uu=u+par+w*.006*depth+vec2(t*.0015*depth,0.);
 vec3 col=samp(uu);
 col+=vec3(.22,.1,.32)*(glow*.8+.15+.08*sin(t*.6))*pow(1.-uv.y,2.5)*exp(-pow((uv.x-.5)*2.,2.))*(.4+depth);
 vec2 g=floor(gl_FragCoord.xy/2.);float st=step(.9975,h(g))*(1.-depth)*(.5+.5*sin(t*2.5+h(g)*60.));col+=st*.55;
 col*=1.-.3*pow(length((uv-.5)*vec2(1.,1.3)),2.2);
 gl_FragColor=vec4(col,1.);}`)
  if (!sky) return null
  const gl = sky.gl, tx = gl.createTexture(), im = new Image()
  sky.set('isz', 16, 9)
  im.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    sky.set('isz', im.width, im.height)
  }
  im.src = src
  return sky
}

// La faille : fissure verticale déchiquetée, lèvres chromées, énergie qui bouillonne, arcs électriques, poussière aspirée.
export const makeRift = (cv: HTMLCanvasElement): Gl | null => glc(cv, `uniform float pull,dive;uniform vec3 c1,c2;
float path(float y){return (fbm(vec2(y*2.2,3.1))-.5)*.34+(n(vec2(y*16.,7.))-.5)*.05+(n(vec2(y*48.,2.))-.5)*.012;}
void main(){vec2 p=(gl_FragCoord.xy-res*.5)/(res.y*.5);float y=p.y;
 float op=clamp(pull*.35+dive,0.,1.);
 float len=.86+op*.1;float env=smoothstep(len,len*.25,abs(y));
 float cx=path(y+t*.015);float d=p.x-cx;float ad=abs(d);
 float w=(.011+op*.30*pow(env,1.3))*env+.002*sin(y*40.+t*3.)*env;
 float inside=smoothstep(w,w-.01-op*.02,ad)*env;
 vec2 q=vec2(d/(w+.02),y*3.);float e=fbm(q*1.6+vec2(0.,-t*1.4)),e2=fbm(q*3.+vec2(t*.7,-t*2.));
 vec3 core=mix(c1,c2,e)*1.2+vec3(1.)*pow(e2,3.)*1.6;core=mix(vec3(1.),core,smoothstep(0.,.7,ad/(w+.001)));
 float lip=exp(-pow((ad-w)/.006,2.))*env;
 vec3 lipc=vec3(1.)*lip*1.2+vec3(1.,.2,.4)*exp(-pow((ad-w-.006)/.006,2.))*env*.5+vec3(.2,.6,1.)*exp(-pow((ad-w+.004)/.005,2.))*env*.4;
 float glow=exp(-max(ad-w,0.)*(7.-op*3.))*env*(.75+op*.6);
 float arcs=0.;for(int i=0;i<4;i++){float fi=float(i);float k=floor(t*7.+fi*1.3);float fl=step(.45,h(vec2(k,fi)));
  float ax=cx+(fbm(vec2(y*7.+k*3.1,fi*5.))-.5)*(.22+op*.35);float span=smoothstep(.0,.2,env)*step(abs(y-(h(vec2(k,fi+9.))-.5)*1.2),.25+.2*h(vec2(fi,k)));
  arcs+=exp(-abs(p.x-ax)*420.)*fl*span*1.5+exp(-abs(p.x-ax)*90.)*fl*span*.35;}
 vec2 g=floor(p*26.);float rnd=h(g);vec2 cell=fract(p*26.)-.5;float tw=fract(rnd*7.+t*.4);
 float dust=step(.93,rnd)*smoothstep(.12,.0,length(cell+vec2(sign(-d)*(tw-.5)*.6,0.)))*(1.-tw)*exp(-ad*3.)*env;
 vec3 col=core*inside+lipc*(1.-inside*.7)+c1*glow*(1.-inside)+mix(c2,vec3(1.),.6)*arcs+vec3(1.)*dust;
 col+=c1*.12*exp(-ad*2.5)*env;
 float al=clamp(inside+lip+glow*.9+arcs+dust+.12*exp(-ad*2.5)*env,0.,1.);
 gl_FragColor=vec4(col*al,al);}`)

/* ================= Canvas 2D ================= */
export const sizeCanvas = (cv: HTMLCanvasElement): Ctx => {
  const d = Math.min(devicePixelRatio || 1, 2), ctx = cv.getContext('2d')!
  cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0)
  return ctx
}

// Prisme hexagonal allongé avec halo, facettes et reflets.
export const crystalRaw = (ctx: Ctx, x: number, y: number, L: number, rot: number, c: string, al: number) => {
  const w = L * 0.42, h = L
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = al * 0.5
  const hl = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 1.7); hl.addColorStop(0, c); hl.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, 0, h * 1.7, 0, 7); ctx.fill(); ctx.globalAlpha = al
  const P = [[0, -h], [w, -h * 0.45], [w, h * 0.45], [0, h], [-w, h * 0.45], [-w, -h * 0.45]]
  ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath()
  const g = ctx.createLinearGradient(-w, -h, w, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.45, c); g.addColorStop(1, 'rgba(40,5,0,.6)')
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h); ctx.moveTo(-w, -h * 0.45); ctx.lineTo(0, -h * 0.1); ctx.lineTo(w, -h * 0.45)
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke(); ctx.restore()
}

// Cristal d'une carte, à la couleur de sa rareté (LR : arc-en-ciel animé).
export const crystal = (ctx: Ctx, x: number, y: number, L: number, rot: number, k: number, pulse: number, t: number) => {
  const c = k === 4 ? `hsl(${(t / 5) % 360},100%,68%)` : `rgb(${rgb(RARITY_RGB[k])})`, w = L * 0.42 * pulse, h = L * pulse
  const halo = ctx.createRadialGradient(x, y, 0, x, y, h * 1.6); halo.addColorStop(0, c); halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 0.55; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, h * 1.6, 0, 7); ctx.fill()
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot) * 0.35); ctx.globalAlpha = 1; const sx = Math.cos(rot)
  const P = [[0, -h], [w * sx, -h * 0.45], [w * sx, h * 0.45], [0, h], [-w * sx, h * 0.45], [-w * sx, -h * 0.45]]
  ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath()
  const g = ctx.createLinearGradient(-w, -h, w, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.45, c); g.addColorStop(1, 'rgba(20,10,30,.6)')
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h); ctx.moveTo(-w * sx, -h * 0.45); ctx.lineTo(0, -h * 0.1); ctx.lineTo(w * sx, -h * 0.45)
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke(); ctx.restore()
}

/* ===== explosion MR ===== */
export type Boom = {
  shards: { a: number; sp: number; len: number; rot: number; vr: number; d: number }[]
  sparks: { a: number; sp: number; l: number; w: number; hue: number }[]
  streaks: { a: number; l: number; w: number }[]
  embers: { a: number; sp: number; s: number; f: number }[]
  noCore?: boolean
}
export const makeBoom = (): Boom => {
  const r = Math.random
  return {
    shards: [...Array(46)].map(() => ({ a: r() * 6.28, sp: 500 + r() * 900, len: 10 + r() * 26, rot: r() * 6, vr: (r() - 0.5) * 14, d: r() * 0.12 })),
    sparks: [...Array(150)].map(() => ({ a: r() * 6.28, sp: 300 + r() * 1300, l: 20 + r() * 80, w: 1 + r() * 2.2, hue: r() })),
    streaks: [...Array(26)].map(() => ({ a: r() * 6.28, l: 0.5 + r() * 0.7, w: 2 + r() * 7 })),
    embers: [...Array(70)].map(() => ({ a: r() * 6.28, sp: 60 + r() * 260, s: 1.5 + r() * 3, f: r() * 6 })),
  }
}

export const boomDraw = (ctx: Ctx, B: Boom, s0: number, cx: number, cy: number, W: number, H: number) => {
  let s = s0
  const M = Math.max(W, H), C = '255,90,40', C2 = '255,190,90'
  ctx.globalCompositeOperation = 'lighter'
  if (s < 0.18) { // implosion : un point qui se contracte avant l'explosion
    const k = s / 0.18, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120 * (1 - k) + 20)
    g.addColorStop(0, '#fff'); g.addColorStop(0.3, `rgba(${C},1)`); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return
  }
  s -= 0.18
  // boule de feu
  const fb = Math.min(1, s / 0.25), fbFade = Math.max(0, 1 - s / 1.3)
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + fb * M * 0.45)
  g.addColorStop(0, `rgba(255,255,255,${fbFade})`); g.addColorStop(0.12, `rgba(${C2},${0.95 * fbFade})`); g.addColorStop(0.35, `rgba(${C},${0.6 * fbFade})`); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // stries de lumière
  ctx.save(); ctx.translate(cx, cy)
  for (const r of B.streaks) {
    const k = Math.min(1, s / 0.35), a = Math.max(0, 1 - s / 0.9)
    ctx.save(); ctx.rotate(r.a); const L = M * r.l * k
    const lg = ctx.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, `rgba(255,255,255,${a})`); lg.addColorStop(0.3, `rgba(${C},${0.7 * a})`); lg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, -r.w * 0.2); ctx.lineTo(L, -r.w); ctx.lineTo(L, r.w); ctx.lineTo(0, r.w * 0.2); ctx.fill(); ctx.restore()
  }
  ctx.restore()
  // ondes de choc
  for (let i = 0; i < 3; i++) {
    const k = (s - i * 0.12) / 0.9
    if (k < 0 || k > 1) continue
    const R = 40 + (1 - Math.pow(1 - k, 3)) * M * (0.55 + i * 0.12)
    ctx.globalAlpha = (1 - k) * (i ? 0.6 : 1); ctx.strokeStyle = i ? `rgb(${C2})` : '#fff'; ctx.lineWidth = (i ? 3 : 7) * (1 - k) + 1
    ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 30; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.78, 0, 0, 7); ctx.stroke()
  }
  ctx.shadowBlur = 0
  // étincelles
  for (const p of B.sparks) {
    const k = s / 1.4
    if (k > 1) continue
    const d = p.sp * (1 - Math.pow(1 - Math.min(k, 1), 2.5)) * 0.9, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.85 + 90 * k * k
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.hue > 0.6 ? '#fff' : p.hue > 0.3 ? `rgb(${C2})` : `rgb(${C})`; ctx.lineWidth = p.w
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(p.a) * p.l * (1 - k), y - Math.sin(p.a) * p.l * (1 - k)); ctx.stroke()
  }
  // éclats de cristal
  for (const p of B.shards) {
    const k = (s - p.d) / 1.5
    if (k < 0 || k > 1) continue
    const d = p.sp * (1 - Math.pow(1 - k, 3)) * 0.55, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.85 + 120 * k * k
    ctx.globalAlpha = 1; crystalRaw(ctx, x, y, p.len * (1 - k * 0.4), p.rot + p.vr * k, `rgb(${C})`, 1 - k)
  }
  // braises
  for (const p of B.embers) {
    const k = s / 2
    if (k > 1) continue
    const d = p.sp * Math.sqrt(k), x = cx + Math.cos(p.a) * d + Math.sin(s * 3 + p.f) * 10, y = cy + Math.sin(p.a) * d - 40 * k
    ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(s * 20 + p.f))
    const eg = ctx.createRadialGradient(x, y, 0, x, y, p.s * 4); eg.addColorStop(0, '#fff'); eg.addColorStop(0.3, `rgb(${C2})`); eg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x, y, p.s * 4, 0, 7); ctx.fill()
  }
  // grand cristal MR qui se reforme
  if (s > 0.9 && !B.noCore) { const k = Math.min(1, (s - 0.9) / 0.6); ctx.globalAlpha = 1; crystalRaw(ctx, cx, cy, 30 + 60 * (1 - Math.pow(1 - k, 3)), s * 2.5, `rgb(${C})`, 1) }
}

// Éclats de verre : secteurs et anneaux irréguliers autour du point de rupture.
export type Shard = { pts: number[][]; mx: number; my: number; vx: number; vy: number; vr: number; del: number }
export const makeShards = (cx: number, cy: number, W: number, H: number): Shard[] => {
  const shards: Shard[] = [], A = 22, rings = [0, 90, 220, 420, Math.hypot(W, H)]
  const ang = [...Array(A)].map((_, i) => ((i + Math.random() * 0.6) / A) * Math.PI * 2)
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < A; i++) {
    const a0 = ang[i], a1 = ang[(i + 1) % A] + (i === A - 1 ? Math.PI * 2 : 0)
    const r0 = rings[r] * (0.85 + Math.random() * 0.3), r1 = rings[r + 1] * (0.85 + Math.random() * 0.3)
    const pts = [[a0, r0], [a1, r0], [a1, r1], [a0, r1]].map(([a, rr]) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
    const mx = pts.reduce((s, p) => s + p[0], 0) / 4, my = pts.reduce((s, p) => s + p[1], 0) / 4, dir = Math.atan2(my - cy, mx - cx), sp = 1.2 + Math.random() * 1.4
    shards.push({ pts: pts.map((p) => [p[0] - mx, p[1] - my]), mx, my, vx: Math.cos(dir) * sp * (300 + r * 120), vy: Math.sin(dir) * sp * (300 + r * 120) - 80, vr: (Math.random() - 0.5) * 6, del: r * 40 + Math.random() * 60 })
  }
  return shards
}

export const drawShards = (ctx: Ctx, shards: Shard[], st: number, acc: RGB) => {
  for (const s of shards) {
    const tt = Math.max(0, st - s.del / 1000)
    if (tt > 1.6) continue
    const x = s.mx + s.vx * tt, y = s.my + s.vy * tt + 260 * tt * tt, al = Math.max(0, 1 - tt / 1.4), k = 1 - tt * 0.25
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.vr * tt); ctx.beginPath()
    s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k))); ctx.closePath()
    const gg = ctx.createLinearGradient(-60, -60, 60, 60)
    gg.addColorStop(0, `rgba(255,255,255,${0.07 * al})`); gg.addColorStop(0.5, `rgba(${rgb(acc)},${0.06 * al})`); gg.addColorStop(1, `rgba(10,8,16,${0.25 * al})`)
    ctx.fillStyle = gg; ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${0.7 * al})`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore()
  }
}
