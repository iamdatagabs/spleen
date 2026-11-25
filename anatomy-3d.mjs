export const SPLENIC_SURFACE_LANDMARKS = Object.freeze([
  { name: "gastric_impression", surface: "visceral", label: "Impressão gástrica" },
  { name: "renal_impression", surface: "visceral", label: "Impressão renal" },
  { name: "colic_impression", surface: "visceral", label: "Impressão cólica" },
  { name: "gastrosplenic_ligament", surface: "visceral", label: "Ligamento gastroesplênico" },
  { name: "splenorenal_ligament", surface: "visceral", label: "Ligamento esplenorrenal" },
  { name: "superior_border_notches", surface: "superior", label: "Incisuras da borda superior" }
]);

export const SPLENIC_VESSEL_HIERARCHY = Object.freeze([
  { name: "splenic_artery", kind: "artery", order: 0 },
  { name: "hilar_segmental_arteries", kind: "artery", order: 1 },
  { name: "trabecular_arteries", kind: "artery", order: 2 },
  { name: "central_arterioles", kind: "artery", order: 3 },
  { name: "penicillar_arterioles", kind: "artery", order: 4 },
  { name: "sheathed_capillaries", kind: "microvascular", order: 5 },
  { name: "splenic_sinusoids", kind: "microvascular", order: 6 },
  { name: "pulp_venules", kind: "vein", order: 7 },
  { name: "trabecular_veins", kind: "vein", order: 8 },
  { name: "splenic_vein", kind: "vein", order: 9 }
]);

export function validateSplenicVesselHierarchy(hierarchy = SPLENIC_VESSEL_HIERARCHY) {
  if (!Array.isArray(hierarchy) || hierarchy.length !== 10) return false;
  if (hierarchy.some((v, i) => v.order !== i || !v.name || !v.kind)) return false;
  const arteryEnd = hierarchy.findIndex(v => v.kind === "microvascular");
  const veinStart = hierarchy.findIndex(v => v.kind === "vein");
  return arteryEnd === 5 && veinStart === 7 &&
    hierarchy[0].name === "splenic_artery" &&
    hierarchy.at(-1).name === "splenic_vein";
}

export function createSplenicAnatomy(THREE, organ, territories) {
  const geometry = new THREE.SphereGeometry(1, 112, 88);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const hilumNotch = Math.exp(-((x - .54) ** 2 / .055 + y ** 2 / .075 + (z - .72) ** 2 / .22));
    const superiorNotches =
      .030 * Math.exp(-((x + .28) ** 2 / .018 + (y - .88) ** 2 / .10 + (z - .18) ** 2 / .45)) +
      .024 * Math.exp(-((x - .10) ** 2 / .020 + (y - .92) ** 2 / .10 + (z + .18) ** 2 / .45));
    const visceralImpressions =
      .050 * Math.exp(-((x + .48) ** 2 / .18 + (y - .12) ** 2 / .20 + (z - .72) ** 2 / .18)) +
      .045 * Math.exp(-((x + .08) ** 2 / .24 + (y - .52) ** 2 / .16 + (z - .70) ** 2 / .16)) +
      .035 * Math.exp(-((x - .28) ** 2 / .20 + (y + .48) ** 2 / .13 + (z - .68) ** 2 / .16));
    const superiorLobulation = .014 * Math.sin(8 * Math.atan2(z, y)) * Math.cos(5 * x);
    const inferiorTaper = 1 - .13 * Math.max(0, -y);
    const radial = 1 + superiorLobulation - .15 * hilumNotch - superiorNotches - visceralImpressions;
    x = x * 1.38 * radial * inferiorTaper;
    y = y * .79 * radial * (1 - .035 * x);
    z = z * .53 * radial - hilumNotch * .12;
    position.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  const initial = new THREE.Color("#8f3545");
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(position.count * 3).fill(0), 3));
  const colors = geometry.attributes.color;
  for (let i = 0; i < colors.count; i++) colors.setXYZ(i, initial.r, initial.g, initial.b);
  colors.needsUpdate = true;

  const surface = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: "#ffffff", vertexColors: true, roughness: .58, metalness: .01,
    clearcoat: .2, clearcoatRoughness: .42
  }));
  surface.castShadow = true;
  surface.receiveShadow = true;
  organ.add(surface);

  const compartments = new THREE.Group();
  compartments.name = "splenic-compartments";
  const trabeculae = new THREE.Group();
  trabeculae.name = "trabecular-framework";
  const capsuleGeometry = geometry.clone();
  capsuleGeometry.scale(1.009, 1.009, 1.009);
  const capsule = new THREE.Mesh(capsuleGeometry, new THREE.MeshPhysicalMaterial({
    color: "#d88e99", roughness: .52, transparent: true, opacity: .12,
    side: THREE.DoubleSide, depthWrite: false
  }));
  capsule.name = "splenic-capsule";
  trabeculae.add(capsule);
  const vascular = new THREE.Group();
  vascular.name = "hierarchical-vascular-tree";
  const impressions = new THREE.Group();
  impressions.name = "visceral-organ-impressions";
  const ligaments = new THREE.Group();
  ligaments.name = "peritoneal-ligaments";
  organ.add(compartments, trabeculae, vascular, impressions, ligaments);

  // Shallow, inset visceral impressions: gastric (largest), renal and colic.
  // These are surface landmarks, not segmented contact areas.
  const impressionMaterial = new THREE.MeshPhysicalMaterial({
    color: "#592b49", roughness: .88, transparent: true, opacity: .20,
    side: THREE.DoubleSide, depthWrite: false
  });
  const makeImpression = (name, position, scale, rotationZ = 0) => {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), impressionMaterial.clone());
    patch.name = name;
    patch.position.set(...position);
    patch.scale.set(...scale);
    patch.rotation.z = rotationZ;
    impressions.add(patch);
    return patch;
  };
  makeImpression("gastric-impression", [-.10,.40,.455], [.48,.31,.018], -.28);
  makeImpression("renal-impression", [-.58,-.02,.435], [.29,.42,.014], .10);
  makeImpression("colic-impression", [.18,-.43,.405], [.32,.20,.012], -.18);

  // Peritoneal reflections are narrow translucent connective-tissue folds at the hilum.
  const ligamentMaterial = new THREE.MeshStandardMaterial({
    color: "#d8c4a4", roughness: .82, transparent: true, opacity: .42,
    side: THREE.DoubleSide, depthWrite: false
  });
  const ligament = (name, points, width) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, width, 7, false), ligamentMaterial.clone());
    mesh.name = name;
    ligaments.add(mesh);
    return mesh;
  };
  ligament("gastrosplenic-ligament", [[.62,.20,.38],[.78,.36,.31],[.95,.48,.18],[1.10,.50,.10]], .025);
  ligament("splenorenal-ligament", [[.62,-.18,.30],[.80,-.32,.24],[.98,-.43,.14],[1.12,-.48,.08]], .023);

  const tube = (points, radius, color, parent, opacity = 1, radialSegments = 8) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const material = new THREE.MeshStandardMaterial({
      color, roughness: .36, metalness: .015, transparent: opacity < 1,
      opacity, emissive: color, emissiveIntensity: .08
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, radialSegments, false), material);
    mesh.castShadow = true;
    parent.add(mesh);
    return { mesh, curve, material };
  };

  // Hilar vessels: arterial inflow and venous drainage are separate, parallel trunks.
  tube([[2.12,.13,.20],[1.72,.10,.25],[1.30,.05,.31],[.82,.015,.36]], .061, "#c94b48", vascular);
  tube([[.82,-.075,.29],[1.28,-.10,.25],[1.70,-.13,.18],[2.12,-.16,.12]], .067, "#527fbd", vascular);

  // Trabeculae radiate from the hilum and carry the larger vessels into the parenchyma.
  const trabecularPaths = [
    [[.78,0,.34],[.45,.36,.34],[.05,.60,.22],[-.55,.62,.08]],
    [[.78,0,.34],[.32,.06,.43],[-.12,.02,.44],[-.72,.02,.28]],
    [[.78,0,.34],[.44,-.34,.34],[.02,-.58,.22],[-.56,-.61,.08]],
    [[.72,.02,.30],[.28,.30,.12],[-.18,.43,-.10],[-.58,.48,-.16]],
    [[.72,-.02,.30],[.28,-.30,.12],[-.18,-.43,-.10],[-.58,-.48,-.16]]
  ];
  trabecularPaths.forEach(path => tube(path, .014, "#d9b99b", trabeculae, .72, 6));

  // Red pulp is the dominant parenchymal bed; small elongated stromal islands add depth.
  const redPulpMaterial = new THREE.MeshStandardMaterial({
    color: "#a74450", roughness: .8, transparent: true, opacity: .20
  });
  const redPulpGeometry = new THREE.SphereGeometry(.035, 8, 6);
  for (let i = 0; i < 64; i++) {
    const a = i * 2.399963229728653;
    const u = ((i * 37) % 97) / 97;
    const x = (u - .5) * 1.75;
    const y = Math.sin(a) * (.52 * Math.sqrt(1 - Math.min(.92, x*x/2.2)));
    const z = Math.cos(a) * .30;
    const island = new THREE.Mesh(redPulpGeometry, redPulpMaterial);
    island.position.set(x, y, z);
    island.scale.set(1.7, .48, .62);
    compartments.add(island);
  }

  const territoryVessels = [];
  territories.forEach((territory, index) => {
    const c = territory.center;
    const center = [c.x, c.y, c.z];
    const artery = tube([
      [.78,.015,.36],
      [.48,c.y*.48,.39],
      [c.x+.24,c.y*.88,c.z+.08],
      center
    ], .026, "#df514b", vascular, .98, 9);
    const vein = tube([
      center,
      [c.x+.18,c.y*.78,c.z-.035],
      [.48,c.y*.38,.30],
      [.82,-.075,.29]
    ], .028, "#6599d1", vascular, .98, 9);

    // Smaller trabecular branches and penicillar arterioles descend toward the pulp.
    for (let branch = 0; branch < 4; branch++) {
      const dy = (branch - 1.5) * .075;
      const dx = (branch % 2 ? .12 : -.12);
      const end = [c.x + dx, c.y + dy, c.z - .035];
      tube([
        [c.x*.72+.12,c.y*.72,c.z+.03],
        [c.x*.88+dx*.4,c.y*.88+dy*.4,c.z],
        end
      ], .009, "#e46a61", vascular, .9, 6);
      tube([
        end,
        [end[0]+.035,end[1]+.025,end[2]-.015],
        [c.x+.12,c.y*.7,c.z-.05]
      ], .007, "#719ed0", vascular, .84, 6);
      const sinusoidPoints = [
        [end[0]-.035,end[1]-.025,end[2]-.025],
        [end[0]+.015,end[1]+.018,end[2]-.01],
        [end[0]+.065,end[1]-.012,end[2]-.025]
      ];
      tube(sinusoidPoints, .0038, "#9d5968", vascular, .62, 5);
    }

    // White-pulp follicles are arranged around central arteriolar profiles.
    for (let follicle = 0; follicle < 3; follicle++) {
      const angle = index * 1.9 + follicle * 2.1;
      const nodule = new THREE.Mesh(
        new THREE.SphereGeometry(.075 + follicle*.008, 18, 14),
        new THREE.MeshPhysicalMaterial({
          color: "#d8c5d4", roughness: .68, transparent: true, opacity: .66,
          clearcoat: .12
        })
      );
      nodule.position.set(c.x + Math.cos(angle)*.13, c.y + Math.sin(angle)*.12, c.z + .015);
      nodule.scale.set(1.0, .82, .58);
      compartments.add(nodule);
      const marginalZone = new THREE.Mesh(
        new THREE.TorusGeometry(.083 + follicle*.008, .007, 6, 24),
        new THREE.MeshStandardMaterial({color:"#d4a66d",roughness:.72,transparent:true,opacity:.55})
      );
      marginalZone.position.copy(nodule.position);
      marginalZone.rotation.set(.35 + follicle*.2, .2 + index*.3, angle);
      compartments.add(marginalZone);
    }

    territoryVessels.push({ artery, vein, arterialBeads: [], venousBeads: [] });
  });

  const hilum = new THREE.Mesh(
    new THREE.SphereGeometry(.10, 24, 16),
    new THREE.MeshStandardMaterial({ color: "#d8b18f", roughness: .58, emissive: "#583329", emissiveIntensity: .16 })
  );
  hilum.position.set(.78, 0, .34);
  organ.add(hilum);

  return {
    geometry, surface, vascular, territoryVessels,
    layers: { vascular, compartments, trabeculae, impressions, ligaments }
  };
}
