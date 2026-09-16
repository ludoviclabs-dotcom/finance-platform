"use client";

/**
 * Atlas 3D — l'anneau des 34 matières critiques autour du globe des pays
 * producteurs. Hauteur d'une tuile = score de risque, teinte = palier de
 * dépendance chinoise. Cliquer une matière fait pivoter le globe vers son
 * premier producteur, trace les flux vers l'Europe et ouvre sa fiche.
 *
 * Répartition des rôles : three.js possède le <canvas> et rien d'autre ; les
 * pastilles de filtre, la fiche et l'étiquette flottante sont du React. La
 * boucle de rendu ne touche au DOM que pour repositionner l'étiquette (via ref,
 * jamais par setState — ce serait un rendu React par image).
 *
 * Chargé par next/dynamic depuis CriticalityTreemap : three.js et la topologie
 * world-atlas ne partent dans le réseau que si l'utilisateur ouvre cette vue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";

import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier, type ChinaTier } from "@/lib/crm/dataLoader";
import { computeCountryWeights, COUNTRY_LL, EUROPE_LL } from "@/lib/crm/countryWeights";
import type { MxTheme } from "../MxThemeProvider";
import { inFamily, type FamilyId } from "./families";

// ── géométrie de la scène ────────────────────────────────────────────────────
const R = 1.0;            // rayon du globe
const RING_R = 2.15;      // rayon de l'anneau de tuiles
const TILE = 0.24;        // côté d'une tuile
const TILE_MIN_H = 0.06;  // hauteur d'une tuile à score nul
const TILE_MAX_H = 0.62;  // hauteur ajoutée à score 10
const LAND_POINTS = 14000;

interface ThemeColors {
  land: number; grid: number; ocean: number; oceanOpacity: number;
  ink: number; accent: number; marker: number; arc: number; hub: number;
  tier: Record<ChinaTier, number>;
  labelOn: Record<ChinaTier, string>;
}

const THEMES: Record<MxTheme, ThemeColors> = {
  clair: {
    land: 0xf2f2f3, grid: 0xf2f2f3, ocean: 0x749dc4, oceanOpacity: 0.92,
    ink: 0x1d1f20, accent: 0x5980a6, marker: 0x1d2d3d, arc: 0x416180, hub: 0x1d1f20,
    tier: { high: 0x2c455d, mid: 0x749dc4, low: 0xd6ebff },
    labelOn: { high: "#f2f2f3", mid: "#f2f2f3", low: "#1d1f20" },
  },
  sombre: {
    land: 0xd6ebff, grid: 0xb5d9fd, ocean: 0x416180, oceanOpacity: 0.9,
    ink: 0xf2f2f3, accent: 0x94bce3, marker: 0xf2f2f3, arc: 0xb5d9fd, hub: 0xf2f2f3,
    tier: { high: 0xd6ebff, mid: 0x749dc4, low: 0x416180 },
    labelOn: { high: "#1d2d3d", mid: "#1d2d3d", low: "#f2f2f3" },
  },
};

// Symbole chimique affiché sur la face externe de la tuile. Le snapshot ne
// porte pas de symbole : cette table le retrouve par nom français, et les
// deux premières lettres servent de repli.
const SYMBOLS: [string, string][] = [
  ["Antimoine", "Sb"], ["Arsenic", "As"], ["Baryte", "Ba"], ["Bauxite", "Al"], ["Béryllium", "Be"],
  ["Bismuth", "Bi"], ["Bore", "B"], ["Cobalt", "Co"], ["Charbon", "C"], ["Cuivre", "Cu"],
  ["Feldspath", "Fs"], ["Fluorine", "F"], ["Gallium", "Ga"], ["Germanium", "Ge"], ["Hafnium", "Hf"],
  ["Hélium", "He"], ["lourdes", "Dy"], ["légères", "Nd"], ["Lithium", "Li"], ["Magnésium", "Mg"],
  ["Manganèse", "Mn"], ["Graphite", "Gr"], ["Nickel", "Ni"], ["Niobium", "Nb"], ["Platino", "Pt"],
  ["Roche phosph", "PO"], ["Phosphore", "P"], ["Scandium", "Sc"], ["Silicium", "Si"], ["Strontium", "Sr"],
  ["Tantale", "Ta"], ["Titane", "Ti"], ["Tungstène", "W"], ["Vanadium", "V"],
];
const symbolOf = (name: string) => SYMBOLS.find(([k]) => name.includes(k))?.[1] ?? name.slice(0, 2);

const scoreOf = (m: Material) => m.carbonco_supply_risk_score ?? 0;
const tierOf = (m: Material) => getChinaTier(getChinaShare(m));

/** (lat, lon) → position cartésienne sur une sphère de rayon r. */
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Relief océanique procédural, en bump map : bruit de valeur sur 5 octaves
 * pour les fonds, plus un terme « ridé » qui dessine les dorsales.
 */
function makeOceanBump(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const rand = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = rand(xi, yi), b = rand(xi + 1, yi), c = rand(xi, yi + 1), e = rand(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0, amp = 0.5, f = 1 / 40;
      for (let o = 0; o < 5; o++) { n += noise(x * f, y * f) * amp; amp *= 0.5; f *= 2.1; }
      const ridge = Math.pow(Math.abs(Math.sin(noise(x / 90, y / 90) * 9 + x / 60)), 3) * 0.35;
      const v = Math.min(255, Math.max(0, (n * 0.75 + ridge) * 255));
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/**
 * Points de terre échantillonnés sur une spirale de Fibonacci, testés contre
 * un rendu équirectangulaire des frontières world-atlas. Sous −58° de
 * latitude, rien n'est tracé : l'Antarctique n'a pas de production à montrer,
 * comme sur la carte 2D.
 */
function buildLandPositions(): Float32Array {
  const W = 1440, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const topology = worldTopology as unknown as Topology;
  const land = feature(
    topology,
    topology.objects.countries as GeometryCollection
  ) as FeatureCollection<Geometry>;

  const projection = geoEquirectangular().fitSize([W, H], { type: "Sphere" });
  const path = geoPath(projection, ctx);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  path(land);
  ctx.fill();

  const alpha = ctx.getImageData(0, 0, W, H).data;
  const positions: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < LAND_POINTS; i++) {
    const y = 1 - (i / (LAND_POINTS - 1)) * 2;
    const lat = (Math.asin(y) * 180) / Math.PI;
    if (lat < -58) continue;
    const lon = (((i * golden) % (Math.PI * 2)) * 180) / Math.PI - 180;
    const projected = projection([lon, lat]);
    if (!projected) continue;
    const px = projected[0] | 0, py = projected[1] | 0;
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    if (alpha[(py * W + px) * 4 + 3] > 128) {
      const v = latLonToVec3(lat, lon, R);
      positions.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(positions);
}

/**
 * Un arc producteur → Europe. `baseDistances` conserve les distances cumulées
 * calculées par computeLineDistances() : LineDashedMaterial n'expose aucun
 * décalage de motif, le défilement s'obtient en ajoutant un offset à ces
 * distances à chaque image.
 */
type ArcLine = THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial> & {
  userData: { baseDistances: Float32Array };
};

interface TileData {
  material: Material;
  height: number;
  tier: ChinaTier;
  group: THREE.Group;
  cap: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  capHeight: number;
}

interface Props {
  materials: Material[];
  theme: MxTheme;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  family: FamilyId;
}

export default function Atlas3DScene({ materials, theme, selectedId, onSelect, family }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Le rendu par image lit des valeurs qui changent côté React : les refléter
  // dans des refs évite de reconstruire la scène à chaque changement d'état.
  const selectedIdRef = useRef(selectedId);
  const familyRef = useRef(family);
  const themeRef = useRef(theme);
  const onSelectRef = useRef(onSelect);
  // La synchronisation se fait après le rendu, pas pendant : écrire dans une
  // ref en plein rendu casse les rendus concurrents. Le décalage d'une image
  // est sans effet ici, la boucle tourne en continu.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    familyRef.current = family;
    themeRef.current = theme;
    onSelectRef.current = onSelect;
  }, [selectedId, family, theme, onSelect]);

  const sceneRef = useRef<{
    tiles: TileData[];
    markers: Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>;
    globe: THREE.Group;
    arcs: ArcLine[];
    ocean: THREE.MeshStandardMaterial;
    grid: THREE.LineBasicMaterial;
    ringLines: THREE.LineBasicMaterial;
    landPoints: THREE.PointsMaterial | null;
    hub: THREE.MeshBasicMaterial;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    headingFont: string;
    bodyFont: string;
    globeTargetY: number | null;
  } | null>(null);

  const sorted = useMemo(
    () => [...materials].sort((a, b) => scoreOf(b) - scoreOf(a)),
    [materials]
  );

  /** Texture de la face externe : symbole, score, nom. */
  const makeLabel = useCallback(
    (m: Material, tier: ChinaTier, themeName: MxTheme, headingFont: string, bodyFont: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 512;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = THEMES[themeName].labelOn[tier];
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `600 150px ${headingFont}`;
      ctx.fillText(symbolOf(m.name_fr), 128, 40);
      ctx.font = `500 40px ${bodyFont}`;
      ctx.fillText(scoreOf(m).toFixed(1), 128, 215);
      ctx.font = `600 30px ${headingFont}`;
      ctx.fillText(m.name_fr.toUpperCase().slice(0, 15), 128, 290);
      ctx.fillRect(64, 350, 128, 2);
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    },
    []
  );

  // ── construction de la scène (une seule fois) ──────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || sorted.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialTheme = themeRef.current;
    const T = THEMES[initialTheme];

    // next/font génère un nom de famille propre au build : on lit la valeur
    // résolue des jetons plutôt que d'écrire "Barlow Condensed" en dur, sans
    // quoi le canvas retomberait sur la police système.
    const cs = getComputedStyle(mount);
    const headingFont = cs.getPropertyValue("--font-heading").trim() || "sans-serif";
    const bodyFont = cs.getPropertyValue("--font-body").trim() || "sans-serif";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 3.1, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-5, 2, -3);
    scene.add(fill);

    const globe = new THREE.Group();
    scene.add(globe);
    const ring = new THREE.Group();
    ring.rotation.x = 0.12;
    scene.add(ring);

    // Corps océanique : sphère bleu acier en relief, sous les points de terre.
    // depthWrite désactivé pour que les points posés juste au-dessus ne soient
    // pas rognés par le tampon de profondeur.
    const oceanBump = makeOceanBump();
    const oceanMat = new THREE.MeshStandardMaterial({
      color: T.ocean, roughness: 0.75, metalness: 0.05,
      transparent: true, opacity: T.oceanOpacity,
      bumpMap: oceanBump, bumpScale: 0.09, depthWrite: false,
    });
    const oceanGeo = new THREE.SphereGeometry(R * 0.985, 96, 64);
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.renderOrder = -1;
    globe.add(ocean);

    // Graticule tous les 30° — la grammaire filaire du système.
    const gridMat = new THREE.LineBasicMaterial({ color: T.grid, transparent: true, opacity: 0.28 });
    const gridPts: THREE.Vector3[] = [];
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -90; lat < 90; lat += 3)
        gridPts.push(latLonToVec3(lat, lon, R * 0.998), latLonToVec3(lat + 3, lon, R * 0.998));
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 3)
        gridPts.push(latLonToVec3(lat, lon, R * 0.998), latLonToVec3(lat, lon + 3, R * 0.998));
    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
    globe.add(new THREE.LineSegments(gridGeo, gridMat));

    // Deux cercles de guidage au sol, de part et d'autre de l'anneau.
    const ringLineMat = new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.22 });
    const innerR = RING_R - TILE * 0.7;
    const ringGeo = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * innerR, -0.001, Math.sin(a) * innerR);
      })
    );
    const ringLine = new THREE.LineLoop(ringGeo, ringLineMat);
    ring.add(ringLine);
    const ringLine2 = new THREE.LineLoop(ringGeo, ringLineMat);
    ringLine2.scale.setScalar((RING_R + TILE * 0.7) / innerR);
    ring.add(ringLine2);

    // ── tuiles ───────────────────────────────────────────────────────────────
    const tiles: TileData[] = [];
    const pickTargets: THREE.Mesh[] = [];
    sorted.forEach((m, i) => {
      const angle = (i / sorted.length) * Math.PI * 2;
      const tier = tierOf(m);
      const height = TILE_MIN_H + (scoreOf(m) / 10) * TILE_MAX_H;

      const geo = new THREE.BoxGeometry(TILE, 1, TILE);
      geo.translate(0, 0.5, 0); // pivot au pied : scale.y devient la hauteur
      const mat = new THREE.MeshStandardMaterial({
        color: T.tier[tier], roughness: 0.6, metalness: 0.05,
        transparent: true, opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.y = 0.001;

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.35 })
      );
      mesh.add(edges);

      const capHeight = Math.min(TILE * 1.92, height - 0.03);
      const cap = new THREE.Mesh(
        new THREE.PlaneGeometry(capHeight / 2, capHeight),
        new THREE.MeshBasicMaterial({
          map: makeLabel(m, tier, initialTheme, headingFont, bodyFont),
          transparent: true,
        })
      );
      cap.rotation.y = Math.PI / 2;
      cap.position.x = TILE / 2 + 0.002;

      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * RING_R, 0, Math.sin(angle) * RING_R);
      group.rotation.y = -angle;
      group.add(mesh);
      group.add(cap);
      ring.add(group);

      mesh.userData.materialId = m.id;
      pickTargets.push(mesh);
      tiles.push({ material: m, height, tier, group, cap, edges, capHeight });
    });

    // ── marqueurs producteurs + pastille Europe ──────────────────────────────
    const markers = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
    const weights = computeCountryWeights(materials);
    const maxTotal = weights[0]?.total || 1;
    for (const w of weights) {
      const ll = COUNTRY_LL[w.country];
      if (!ll) continue;
      const size = 0.012 + 0.05 * Math.sqrt(w.total / maxTotal);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 12),
        new THREE.MeshBasicMaterial({ color: T.marker, transparent: true, opacity: 0.85 })
      );
      marker.position.copy(latLonToVec3(ll[1], ll[0], R + 0.005));
      globe.add(marker);
      markers.set(w.country, marker);
    }
    const hubMat = new THREE.MeshBasicMaterial({ color: T.hub, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const hub = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 32), hubMat);
    hub.position.copy(latLonToVec3(EUROPE_LL[1], EUROPE_LL[0], R + 0.01));
    hub.lookAt(new THREE.Vector3(0, 0, 0));
    globe.add(hub);

    // ── points de terre ──────────────────────────────────────────────────────
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute("position", new THREE.BufferAttribute(buildLandPositions(), 3));
    const landMat = new THREE.PointsMaterial({
      color: T.land, size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0,
    });
    globe.add(new THREE.Points(landGeo, landMat));

    sceneRef.current = {
      tiles, markers, globe, arcs: [], ocean: oceanMat, grid: gridMat, ringLines: ringLineMat,
      landPoints: landMat, hub: hubMat, camera, renderer, headingFont, bodyFont, globeTargetY: null,
    };
    setReady(true);

    // ── interaction ──────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;
    let pointerDownAt = 0;

    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickTargets, false)[0];
      hovered = (hit?.object as THREE.Mesh) ?? null;
      renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    };
    const onPointerLeave = () => { hovered = null; };
    const onPointerDown = () => { pointerDownAt = performance.now(); };
    const onPointerUp = (e: PointerEvent) => {
      // Sous 250 ms, c'est un clic ; au-delà, l'utilisateur faisait tourner
      // le globe et ne veut pas sélectionner la tuile relâchée.
      if (performance.now() - pointerDownAt >= 250) return;
      pick(e);
      if (hovered) {
        const id = hovered.userData.materialId as string;
        onSelectRef.current(selectedIdRef.current === id ? null : id);
      }
    };
    renderer.domElement.addEventListener("pointermove", pick);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // ── boucle ───────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const emissive = new THREE.Color();
    let started: number | null = null;
    let frameId = 0;
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const frame = () => {
      frameId = requestAnimationFrame(frame);
      const state = sceneRef.current;
      if (!state) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = clock.getElapsedTime();
      if (started === null) started = now;

      const TT = THEMES[themeRef.current];
      const selId = selectedIdRef.current;
      const fam = familyRef.current;
      const selectedTile = selId ? tiles.find(t => t.material.id === selId) ?? null : null;

      // Intro : les tuiles montent en séquence, la terre se révèle.
      tiles.forEach((t, i) => {
        const k = Math.max(0, Math.min(1, (now - started! - i * 0.045) / 0.9));
        const mesh = t.group.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
        mesh.scale.y = Math.max(0.001, t.height * (reduced ? 1 : ease(k)));
        t.cap.position.y = Math.max(t.capHeight / 2 + 0.01, mesh.scale.y - t.capHeight / 2 - 0.015);
        t.cap.material.opacity = ease(k) * mesh.material.opacity;
      });
      if (landMat) landMat.opacity = Math.min(0.95, (now - started) / 1.4);

      // Dérive de l'anneau au repos.
      if (!selectedTile && !hovered && !reduced) ring.rotation.y -= dt * 0.06;
      if (state.globeTargetY !== null) {
        globe.rotation.y += (state.globeTargetY - globe.rotation.y) * Math.min(1, dt * 3.5);
      } else if (!reduced) {
        globe.rotation.y += dt * 0.04;
      }

      // État par tuile : atténuation hors famille, soulèvement au survol/choix.
      tiles.forEach(t => {
        const mesh = t.group.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
        const active = mesh === hovered || t === selectedTile;
        const onFamily = inFamily(t.material, fam);
        const targetY = active ? 0.12 : 0;
        t.group.position.y += (targetY - t.group.position.y) * Math.min(1, dt * 10);

        let targetOpacity = onFamily ? 1 : 0.18;
        if (selectedTile && t !== selectedTile && onFamily) targetOpacity = 0.55;
        mesh.material.opacity += (targetOpacity - mesh.material.opacity) * Math.min(1, dt * 8);
        t.edges.material.opacity = 0.35 * mesh.material.opacity;
        mesh.material.emissive.copy(emissive.setHex(TT.accent).multiplyScalar(active ? 0.35 : 0));
      });

      // Les arcs se révèlent, puis leur pointillé défile vers l'Europe.
      const dashOffset = reduced ? 0 : -now * 0.35;
      state.arcs.forEach(a => {
        a.material.opacity = Math.min(0.9, a.material.opacity + (0.9 - a.material.opacity) * Math.min(1, dt * 4));
        if (reduced) return;
        const attr = a.geometry.getAttribute("lineDistance") as THREE.BufferAttribute;
        const base = a.userData.baseDistances;
        for (let i = 0; i < base.length; i++) attr.setX(i, base[i] + dashOffset);
        attr.needsUpdate = true;
      });

      // Producteurs de la matière choisie : pulsation, les autres s'effacent.
      markers.forEach((marker, country) => {
        const emphasised = !!selectedTile?.material.top_producers.some(p => p.country === country);
        marker.scale.setScalar(emphasised ? 1.6 + Math.sin(now * 4) * 0.25 : 1);
        marker.material.opacity = selectedTile ? (emphasised ? 1 : 0.25) : 0.85;
      });

      // Étiquette flottante : projetée à chaque image, écrite directement dans
      // le DOM (un setState par image reconstruirait l'arbre React 60 fois/s).
      const tag = tagRef.current;
      if (tag) {
        if (selectedTile) {
          tmp.set(0, selectedTile.height + 0.18, 0);
          selectedTile.group.localToWorld(tmp);
          tmp.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          const x = (tmp.x * 0.5 + 0.5) * rect.width;
          const y = (-tmp.y * 0.5 + 0.5) * rect.height;
          tag.style.opacity = tmp.z > 1 ? "0" : "1";
          tag.style.left = `${Math.max(70, Math.min(rect.width - 70, x))}px`;
          tag.style.top = `${Math.max(60, y - 12)}px`;
        } else {
          tag.style.opacity = "0";
        }
      }

      controls.autoRotate = !reduced && !selectedTile;
      controls.update();
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", pick);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      // WebGL ne libère pas ses tampons au ramasse-miettes : chaque géométrie,
      // matériau et texture créés ici doit être libéré explicitement, sinon
      // basculer Treemap ↔ Atlas fuit un contexte à chaque aller-retour.
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat) {
          const withMap = mat as THREE.MeshBasicMaterial;
          withMap.map?.dispose();
          mat.dispose();
        }
      });
      oceanBump.dispose();
      sceneRef.current?.arcs.forEach(a => { a.geometry.dispose(); a.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
    // La scène est construite une fois pour un jeu de matières donné ; le
    // thème et la sélection passent par des refs et les effets ci-dessous,
    // pour ne jamais reconstruire le contexte WebGL sur un simple changement
    // d'état.
  }, [sorted, materials, makeLabel]);

  // ── sélection : arcs vers l'Europe + rotation du globe ─────────────────────
  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !ready) return;

    state.arcs.forEach(a => { state.globe.remove(a); a.geometry.dispose(); a.material.dispose(); });
    state.arcs = [];

    const material = selectedId ? materials.find(m => m.id === selectedId) : null;
    if (!material) { state.globeTargetY = null; return; }

    const europe = latLonToVec3(EUROPE_LL[1], EUROPE_LL[0], R);
    for (const p of material.top_producers) {
      const ll = COUNTRY_LL[p.country];
      if (!ll || p.country === "Europe") continue;
      const from = latLonToVec3(ll[1], ll[0], R + 0.005);
      const mid = from.clone().add(europe).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(R + 0.12 + from.distanceTo(europe) * 0.28);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, europe);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
      const mat = new THREE.LineDashedMaterial({
        color: THEMES[theme].arc, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0,
      });
      const line = new THREE.Line(geo, mat) as ArcLine;
      line.computeLineDistances();
      const distances = line.geometry.getAttribute("lineDistance") as THREE.BufferAttribute;
      line.userData = { baseDistances: Float32Array.from(distances.array as Float32Array) };
      state.globe.add(line);
      state.arcs.push(line);
    }

    // Amène le premier producteur face à la caméra, avec un léger décalage
    // pour que l'Europe reste dans le champ.
    const marker = state.markers.get(material.top_producers[0]?.country ?? "");
    if (marker) {
      const markerAngle = Math.atan2(marker.position.x, marker.position.z);
      const cameraAngle = Math.atan2(state.camera.position.x, state.camera.position.z);
      let target = cameraAngle - markerAngle + 0.35;
      const current = state.globe.rotation.y;
      while (target - current > Math.PI) target -= Math.PI * 2;
      while (target - current < -Math.PI) target += Math.PI * 2;
      state.globeTargetY = target;
    }
  }, [selectedId, materials, theme, ready]);

  // ── thème : re-teinte sans reconstruire la scène ───────────────────────────
  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !ready) return;
    const T = THEMES[theme];
    state.ocean.color.setHex(T.ocean);
    state.ocean.opacity = T.oceanOpacity;
    state.grid.color.setHex(T.grid);
    state.ringLines.color.setHex(T.ink);
    state.hub.color.setHex(T.hub);
    state.landPoints?.color.setHex(T.land);
    state.markers.forEach(m => m.material.color.setHex(T.marker));
    state.arcs.forEach(a => a.material.color.setHex(T.arc));
    state.tiles.forEach(t => {
      const mesh = t.group.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
      mesh.material.color.setHex(T.tier[t.tier]);
      t.edges.material.color.setHex(T.ink);
      // L'étiquette est une texture cuite : sa couleur d'encre dépend du
      // thème, il faut la redessiner et libérer l'ancienne.
      t.cap.material.map?.dispose();
      t.cap.material.map = makeLabel(t.material, t.tier, theme, state.headingFont, state.bodyFont);
      t.cap.material.needsUpdate = true;
    });
  }, [theme, ready, makeLabel]);

  const selected = selectedId ? materials.find(m => m.id === selectedId) ?? null : null;

  return (
    <>
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={tagRef}
        aria-hidden="true"
        className="absolute pointer-events-none whitespace-nowrap"
        style={{
          transform: "translate(-50%,-100%)",
          padding: "4px 8px",
          border: "1px solid var(--color-divider)",
          background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
          backdropFilter: "blur(6px)",
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: ".02em",
          textTransform: "uppercase",
          opacity: 0,
          transition: "opacity .25s",
        }}
      >
        {selected?.name_fr}
        {selected && (
          <small style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 11, textTransform: "none", letterSpacing: 0, color: "var(--ink-70)", marginLeft: 6 }}>
            score {scoreOf(selected).toFixed(1)}
          </small>
        )}
      </div>
    </>
  );
}
