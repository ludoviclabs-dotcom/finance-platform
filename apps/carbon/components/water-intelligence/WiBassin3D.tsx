"use client";

/**
 * WiBassin3D.tsx — coupe pédagogique 3D du bassin versant (Water Intelligence
 * v2).
 *
 * ## Ce qui vient de la maquette, et ce qui vient d'ici
 *
 * Le graphe de scène — socle, nappe, montagnes, rivière, mer, forêt, nuage,
 * pluie, forage — est repris OCTET POUR OCTET de `bassin3d.html` : mêmes
 * géométries, mêmes matériaux, mêmes positions, mêmes noms d'objets. C'est le
 * contenu de conception, il ne s'invente pas.
 *
 * Le harnais qui l'entoure — renderer, caméra, lumières, `OrbitControls`,
 * redimensionnement, export — est écrit ici : la maquette chargeait un
 * `<three-d-stage>` défini par `three-d-stage.js`, un fichier non fourni.
 * C'est de la plomberie Three.js standard, pas une décision de design ; la
 * réécrire n'invente rien que la bibliothèque elle-même ne documente pas.
 *
 * ## Pourquoi un composant client, et ce qu'il ne fait pas au serveur
 *
 * WebGL exige le DOM. Le montage (scène, rendu, boucle d'animation) vit
 * entièrement dans un `useEffect` : rien ne s'exécute au rendu serveur, et le
 * test de rendu statique de la page ne voit que le conteneur, la légende et
 * les deux boutons d'export — jamais une trame WebGL.
 *
 * `prefers-reduced-motion` coupe la rotation automatique ; elle reste
 * disponible à la souris et au clavier (`OrbitControls` gère les deux).
 */

import { useEffect, useRef, useState } from "react";

export interface WiBassin3DProps {
  readonly reducedMotion?: boolean;
}

type LoadState = "loading" | "ready" | "unavailable";

/** Le graphe de scène — transcrit tel quel depuis `bassin3d.html`. */
async function buildBassinGroup() {
  const THREE = await import("three");

  const M = {
    roche: new THREE.MeshStandardMaterial({ color: 0x4a5e74, roughness: 0.95 }),
    sol: new THREE.MeshStandardMaterial({ color: 0x2f5d46, roughness: 0.9 }),
    nappe: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.35,
      transparent: true,
      opacity: 0.55,
    }),
    eau: new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.2, metalness: 0.1 }),
    mer: new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.25 }),
    neige: new THREE.MeshStandardMaterial({ color: 0xe8f4fb, roughness: 0.8 }),
    nuage: new THREE.MeshStandardMaterial({
      color: 0xcfe6f5,
      roughness: 1,
      transparent: true,
      opacity: 0.9,
    }),
    pluie: new THREE.MeshStandardMaterial({ color: 0x7fd4f0, transparent: true, opacity: 0.55 }),
    tronc: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 }),
    acier: new THREE.MeshStandardMaterial({ color: 0xb9c7d4, roughness: 0.5, metalness: 0.3 }),
    pompe: new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.5 }),
  };
  /* `usemtl` (OBJExporter) et le sérialiseur MTL ci-dessous doivent
     référencer le MÊME nom : sans `.name`, l'export OBJ+MTL produirait des
     références de matériau vides. */
  for (const [key, material] of Object.entries(M)) {
    material.name = key;
  }

  const g = new THREE.Group();
  g.name = "bassin_versant";

  const socle = new THREE.Mesh(new THREE.BoxGeometry(10, 1.6, 6), M.roche);
  socle.name = "socle_rocheux";
  socle.position.y = 0.8;
  g.add(socle);

  const nappe = new THREE.Mesh(new THREE.BoxGeometry(10.02, 0.55, 6.02), M.nappe);
  nappe.name = "nappe_phreatique";
  nappe.position.y = 1.55;
  g.add(nappe);

  const sol = new THREE.Mesh(new THREE.BoxGeometry(10.01, 0.4, 6.01), M.sol);
  sol.name = "sol";
  sol.position.y = 2.0;
  g.add(sol);

  function mont(x: number, z: number, r: number, h: number, nom: string) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), M.roche);
    m.name = nom;
    m.position.set(x, 2.2 + h / 2 - 0.05, z);
    return m;
  }
  g.add(mont(-3.4, -2.1, 1.7, 2.6, "montagne_ouest"));
  g.add(mont(-1.6, -2.4, 1.3, 3.4, "montagne_centrale"));
  g.add(mont(0.2, -2.2, 1.1, 2.1, "montagne_est"));

  const neige = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 24), M.neige);
  neige.name = "neiges_eternelles";
  neige.position.set(-1.6, 5.05, -2.4);
  g.add(neige);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.6, 2.25, -1.6),
    new THREE.Vector3(-0.6, 2.22, -0.6),
    new THREE.Vector3(0.8, 2.21, 0.2),
    new THREE.Vector3(1.6, 2.21, 1.2),
    new THREE.Vector3(2.6, 2.21, 2.2),
    new THREE.Vector3(3.6, 2.21, 2.8),
  ]);
  const riviere = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.22, 10, false), M.eau);
  riviere.name = "riviere";
  riviere.scale.y = 0.25;
  riviere.position.y = 1.66;
  g.add(riviere);

  const mer = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.4), M.mer);
  mer.name = "mer";
  mer.position.set(4.0, 2.12, 2.6);
  g.add(mer);

  function arbre(x: number, z: number, s: number, i: number) {
    const grp = new THREE.Group();
    grp.name = "arbre_" + i;
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.3 * s, 8),
      M.tronc,
    );
    t.name = "tronc_" + i;
    t.position.y = 0.15 * s;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.55 * s, 10), M.sol);
    f.name = "feuillage_" + i;
    f.position.y = 0.55 * s;
    grp.add(t, f);
    grp.position.set(x, 2.2, z);
    return grp;
  }
  (
    [
      [-3.2, 0.4, 1],
      [-2.6, 1.1, 0.8],
      [-3.6, 1.6, 1.1],
      [-2.1, 1.9, 0.9],
      [-1.2, 1.2, 0.7],
    ] as const
  ).forEach((p, i) => g.add(arbre(p[0], p[1], p[2], i)));

  const nuage = new THREE.Group();
  nuage.name = "nuage";
  (
    [
      [0, 0, 0, 0.55],
      [0.5, 0.1, 0.1, 0.42],
      [-0.5, 0.05, -0.05, 0.45],
      [0.15, 0.28, 0, 0.4],
    ] as const
  ).forEach((p, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(p[3], 18, 14), M.nuage);
    s.name = "nuage_" + i;
    s.position.set(p[0], p[1], p[2]);
    nuage.add(s);
  });
  nuage.position.set(-1.6, 5.9, -1.0);
  g.add(nuage);

  for (let i = 0; i < 7; i++) {
    const goutte = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), M.pluie);
    goutte.name = "pluie_" + i;
    goutte.position.set(-2.3 + (i % 4) * 0.45, 5.0 - (i % 3) * 0.35, -1.3 + (i % 2) * 0.5);
    g.add(goutte);
  }

  const puits = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 12), M.acier);
  puits.name = "forage_prelevement";
  puits.position.set(1.9, 2.15, -0.8);
  g.add(puits);

  const pompe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), M.pompe);
  pompe.name = "station_pompage";
  pompe.position.set(1.9, 2.85, -0.8);
  g.add(pompe);

  g.position.set(0, 0, 0);
  return { THREE, group: g };
}

export function WiBassin3D({ reducedMotion = false }: WiBassin3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<unknown>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | undefined;
    let renderer: import("three").WebGLRenderer | undefined;
    let controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls | undefined;

    (async () => {
      try {
        const [{ THREE, group }, { OrbitControls }] = await Promise.all([
          buildBassinGroup(),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
        if (disposed) return;

        groupRef.current = { THREE, group };

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a1626);
        scene.add(group);

        scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(6, 10, 4);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0x38bdf8, 0.3);
        fill.position.set(-6, 4, -4);
        scene.add(fill);

        const width = container.clientWidth || 640;
        const height = container.clientHeight || 520;
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.set(7.5, 6, 8);
        camera.lookAt(0, 2.2, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        /* Un <canvas> n'est pas focalisable par défaut : sans `tabIndex`, Tab
           saute le cadre 3D et `listenToKeyEvents` ne reçoit jamais rien —
           la navigation clavier annoncée dans la légende serait un mensonge. */
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute(
          "aria-label",
          "Coupe 3D interactive du bassin versant — flèches pour orbiter une fois le cadre focalisé",
        );
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 2.2, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 4;
        controls.maxDistance = 20;
        controls.autoRotate = !reducedMotion;
        controls.autoRotateSpeed = 0.6;
        controls.listenToKeyEvents(renderer.domElement);

        const stopAutoRotate = () => {
          if (controls) controls.autoRotate = false;
        };
        renderer.domElement.addEventListener("pointerdown", stopAutoRotate, { once: true });
        renderer.domElement.addEventListener("wheel", stopAutoRotate, { once: true });
        renderer.domElement.addEventListener("keydown", stopAutoRotate, { once: true });

        const renderLoop = () => {
          controls?.update();
          renderer?.render(scene, camera);
          frameId = requestAnimationFrame(renderLoop);
        };
        renderLoop();

        resizeObserver = new ResizeObserver(() => {
          if (!renderer || !container) return;
          const w = container.clientWidth || width;
          const h = container.clientHeight || height;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });
        resizeObserver.observe(container);

        setState("ready");
      } catch {
        /* WebGL indisponible ou échec de chargement du module : la coupe 3D
           n'est qu'une illustration pédagogique, jamais une donnée — un état
           de repli honnête vaut mieux qu'une page cassée. */
        if (!disposed) setState("unavailable");
      }
    })();

    return () => {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [reducedMotion]);

  const exportObj = async () => {
    const built = groupRef.current as { THREE: typeof import("three"); group: import("three").Group } | null;
    if (!built) return;
    const { OBJExporter } = await import("three/examples/jsm/exporters/OBJExporter.js");
    const exporter = new OBJExporter();
    const objText = exporter.parse(built.group);
    /* `OBJExporter` documente lui-même ne pas produire de fichier MTL — voir
       sa source. Le bouton annonce « OBJ + MTL » : le fichier MTL doit donc
       exister réellement, sérialisé ici à partir des mêmes matériaux nommés
       (`.name`, posé dans `buildBassinGroup`) que ceux référencés par les
       lignes `usemtl` de l'OBJ. */
    const mtlText = buildMtlText(built.group);
    downloadText("bassin-versant.obj", `mtllib bassin-versant.mtl\n${objText}`);
    downloadText("bassin-versant.mtl", mtlText);
  };

  const exportGlb = async () => {
    const built = groupRef.current as { THREE: typeof import("three"); group: import("three").Group } | null;
    if (!built) return;
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const exporter = new GLTFExporter();
    exporter.parse(
      built.group,
      (result) => {
        const buffer = result as ArrayBuffer;
        downloadBinary("bassin-versant.glb", buffer);
      },
      (error) => {
        console.error("Export GLB impossible", error);
      },
      { binary: true },
    );
  };

  return (
    <div>
      <div className="wi-bassin-canvas-wrap" data-testid="wi-bassin-3d">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} aria-hidden={state !== "ready"} />
        {state !== "ready" && (
          <p className="wi-bassin-loading">
            {state === "loading"
              ? "Chargement de la coupe 3D…"
              : "Coupe 3D indisponible dans ce navigateur — illustration pédagogique uniquement, aucune donnée n'y est portée."}
          </p>
        )}
        {state === "ready" && (
          <>
            <span className="wi-bassin-hint" aria-hidden="true">
              Glisser pour orbiter · molette pour zoomer · clic droit pour déplacer
            </span>
            <div className="wi-bassin-export">
              <button type="button" onClick={exportObj} data-testid="wi-bassin-export-obj">
                Télécharger OBJ + MTL
              </button>
              <button type="button" onClick={exportGlb} data-testid="wi-bassin-export-glb">
                Télécharger GLB
              </button>
            </div>
          </>
        )}
      </div>
      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
        Illustration pédagogique interactive du cycle de l&apos;eau à l&apos;échelle
        d&apos;un bassin&nbsp;: précipitations, écoulement de surface, stock de nappe
        et point de prélèvement. Naviguez à la souris ou au clavier (Tab puis
        flèches une fois le cadre 3D focalisé) ; aucune valeur du pilote n&apos;y est
        représentée.
      </p>
    </div>
  );
}

/**
 * Sérialise les matériaux du groupe en MTL — three.js n'en fournit pas
 * (`OBJExporter` ne gère que la géométrie). Chaque matériau de la scène est
 * un `MeshStandardMaterial` plat (couleur, rugosité, métallicité, opacité),
 * sans texture : le mapping vers les champs MTL classiques est direct et
 * n'a besoin d'aucune approximation hasardeuse.
 */
function buildMtlText(group: import("three").Group): string {
  const seen = new Map<string, import("three").MeshStandardMaterial>();
  group.traverse((object) => {
    const material = (object as import("three").Mesh).material as
      | import("three").MeshStandardMaterial
      | undefined;
    if (material?.name && !seen.has(material.name)) {
      seen.set(material.name, material);
    }
  });

  const blocks = [...seen.entries()].map(([name, material]) => {
    const { r, g, b } = material.color;
    const specular = 0.04 + material.metalness * 0.6;
    const shininess = Math.round(10 + (1 - material.roughness) * 900);
    const opacity = material.transparent ? material.opacity : 1;
    return [
      `newmtl ${name}`,
      `Ka ${(r * 0.2).toFixed(4)} ${(g * 0.2).toFixed(4)} ${(b * 0.2).toFixed(4)}`,
      `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`,
      `Ks ${specular.toFixed(4)} ${specular.toFixed(4)} ${specular.toFixed(4)}`,
      `Ns ${shininess}`,
      `d ${opacity.toFixed(4)}`,
      `illum 2`,
    ].join("\n");
  });

  return `# bassin-versant.mtl — illustration pédagogique, aucune donnée\n${blocks.join("\n\n")}\n`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  triggerDownload(filename, blob);
}

function downloadBinary(filename: string, content: ArrayBuffer) {
  const blob = new Blob([content], { type: "application/octet-stream" });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
