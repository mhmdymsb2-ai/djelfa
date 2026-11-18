import * as THREE from 'three';
import { SHOPS } from './storyData';
import {
  createAsphaltTexture,
  createBuildingFacadeTexture,
  createSignTexture,
  createTerrainTexture,
} from './textures';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldData {
  colliders: ColliderBox[];
  hostageDoorMesh: THREE.Mesh;
  shopRings: THREE.Mesh[];
}

export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  if (dist < 135) return 0;
  const t = Math.min(1, (dist - 135) / 145);
  const ridge =
    Math.sin(x * 0.035) * Math.cos(z * 0.035) * 4.5 +
    Math.sin(x * 0.08 + z * 0.06) * 1.4;
  return t * t * (10 + ridge);
}

export function buildDjelfaWorld(scene: THREE.Scene, maxAniso: number): WorldData {
  const colliders: ColliderBox[] = [];
  const shopRings: THREE.Mesh[] = [];

  // 1. Extended Djelfa Highland Terrain
  const terrainGeo = new THREE.PlaneGeometry(580, 580, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeightAt(x, z));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: createTerrainTexture(maxAniso),
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 2. Djelfa Road Network
  const asphaltTex = createAsphaltTexture(maxAniso);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.84,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), roadMat);
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.set(0, 0.03, 0);
  nsRoad.receiveShadow = true;
  scene.add(nsRoad);

  const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), roadMat);
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.rotation.z = Math.PI / 2;
  ewRoad.position.set(0, 0.035, 0);
  ewRoad.receiveShadow = true;
  scene.add(ewRoad);

  const indRoad = new THREE.Mesh(new THREE.PlaneGeometry(11, 140), roadMat);
  indRoad.rotation.x = -Math.PI / 2;
  indRoad.position.set(-74, 0.032, 35);
  indRoad.receiveShadow = true;
  scene.add(indRoad);

  const senRoad = new THREE.Mesh(new THREE.PlaneGeometry(11, 120), roadMat);
  senRoad.rotation.x = -Math.PI / 2;
  senRoad.rotation.z = Math.PI / 2;
  senRoad.position.set(-55, 0.033, -76);
  senRoad.receiveShadow = true;
  scene.add(senRoad);

  // 3. Central Djelfa Roundabout (ساحة أول نوفمبر)
  const roundabout = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11.4, 0.35, 32),
    new THREE.MeshStandardMaterial({ color: 0xc2b29b, roughness: 0.85 })
  );
  roundabout.position.set(0, 0.175, 0);
  roundabout.receiveShadow = true;
  scene.add(roundabout);

  const monumentBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd6c7b2, roughness: 0.7 })
  );
  monumentBase.position.set(0, 0.9, 0);
  monumentBase.castShadow = true;
  scene.add(monumentBase);

  const monumentPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.05, 7.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.65 })
  );
  monumentPillar.position.set(0, 5.2, 0);
  monumentPillar.castShadow = true;
  scene.add(monumentPillar);

  colliders.push({ minX: -3.2, maxX: 3.2, minZ: -3.2, maxZ: 3.2 });

  const addBuilding = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    wallHex: string,
    accentHex: string,
    sign?: { title: string; subtitle: string; bg?: string; text?: string; faceZ?: number }
  ) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const facadeTex = createBuildingFacadeTexture(maxAniso, wallHex, accentHex);
    const wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.86,
      metalness: 0.04,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92 });
    const trimMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.75 });

    const mainMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mainMesh.position.y = h / 2;
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), roofMat);
    parapet.position.y = h + 0.3;
    parapet.castShadow = true;
    group.add(parapet);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 })
    );
    tank.position.set(w * 0.24, h + 1.25, -d * 0.2);
    tank.castShadow = true;
    group.add(tank);

    const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.25, 1.1), trimMat);
    balcony.position.set(0, h * 0.54, d / 2 + 0.5);
    balcony.castShadow = true;
    group.add(balcony);

    if (sign) {
      const signTex = createSignTexture(
        maxAniso,
        sign.title,
        sign.subtitle,
        sign.bg || '#141923',
        sign.text || '#fbbf24'
      );
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.88, 8.2), 2.2),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      const zFace = sign.faceZ ?? 1;
      signMesh.position.set(0, 3.8, zFace * (d / 2 + 0.08));
      if (zFace < 0) signMesh.rotation.y = Math.PI;
      group.add(signMesh);
    }

    scene.add(group);
    colliders.push({
      minX: x - w / 2 - 0.3,
      maxX: x + w / 2 + 0.3,
      minZ: z - d / 2 - 0.3,
      maxZ: z + d / 2 + 0.3,
    });
  };

  // 4. Key Story Landmarks & Open Shops in Djelfa
  // Mosaab's Home (حي المصلى)
  addBuilding(22, 68, 13, 8.5, 11, '#d6b892', '#6b4f35', {
    title: 'حي المصلى · دار مصعب',
    subtitle: 'منطقة سكنية - ولاية الجلفة 17',
    bg: '#1c1917',
    text: '#f59e0b',
    faceZ: -1,
  });

  // 1) Informant Café (مقهى أول نوفمبر)
  addBuilding(18, -24, 14, 7.5, 10, '#cbb08a', '#3b2f24', {
    title: 'مقهى أول نوفمبر · مفتوح',
    subtitle: 'قهوة وأتاي · السونتر فيل',
    bg: '#111827',
    text: '#fbbf24',
    faceZ: 1,
  });

  // 2) Grocery Shop (سوق وبقالة حي المصلى)
  addBuilding(-24, 62, 12, 7.2, 10, '#cfb38e', '#15803d', {
    title: 'بقالة وسوق المصلى · مفتوح',
    subtitle: 'مواد غذائية وإسعافات 24/24',
    bg: '#052e16',
    text: '#4ade80',
    faceZ: -1,
  });

  // 3) Weapon & Gear Shop (مركز السلاح والعتاد)
  addBuilding(-24, 26, 12, 9.5, 11, '#9ca3af', '#7f1d1d', {
    title: 'مركز السلاح والعتاد',
    subtitle: 'ذخيرة · دروع · أسلحة ثقيلة',
    bg: '#1f0b0b',
    text: '#f87171',
    faceZ: -1,
  });

  // 4) Ally Gang Garage HQ (ورشة صقور الهضاب)
  addBuilding(-88, 86, 18, 7.2, 13, '#64748b', '#92400e', {
    title: 'قاراج ومعرض صقور الهضاب',
    subtitle: 'تصليح · صباغة · بيع السيارات 17',
    bg: '#18181b',
    text: '#f97316',
    faceZ: -1,
  });

  // 5) Medical Clinic (مركز الاستعجالات الطبية)
  addBuilding(34, -56, 15, 8.2, 12, '#e2e8f0', '#047857', {
    title: 'مركز الاستعجالات الطبية',
    subtitle: 'علاج فوري · الجلفة 24/24',
    bg: '#022c22',
    text: '#34d399',
    faceZ: 1,
  });

  // 6) Naftal Gas & Car Service Station (محطة نفطال 17)
  const naftalGroup = new THREE.Group();
  naftalGroup.position.set(42, 0, -22);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 })
  );
  canopy.position.y = 5.2;
  canopy.castShadow = true;
  naftalGroup.add(canopy);

  const naftalTrim = new THREE.Mesh(
    new THREE.BoxGeometry(14.2, 0.35, 10.2),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  naftalTrim.position.y = 5.65;
  naftalGroup.add(naftalTrim);

  for (const px of [-5, 5]) {
    for (const pz of [-3.5, 3.5]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 5.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 })
      );
      pillar.position.set(px, 2.6, pz);
      pillar.castShadow = true;
      naftalGroup.add(pillar);
    }
  }
  for (const px of [-2.4, 2.4]) {
    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.8, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    pump.position.set(px, 0.9, 0);
    pump.castShadow = true;
    naftalGroup.add(pump);
  }
  const naftalSign = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 2.1),
    new THREE.MeshBasicMaterial({
      map: createSignTexture(maxAniso, 'محطة نفطال · NAFTAL 17', 'بنزين · غسل · صيانة سريعة', '#0c4a6e', '#facc15'),
    })
  );
  naftalSign.position.set(0, 6.9, 5.15);
  naftalGroup.add(naftalSign);
  scene.add(naftalGroup);

  // Open Shop Glowing Entrance Portals & Ground Rings
  const doorMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
  SHOPS.forEach((shop) => {
    const markerGroup = new THREE.Group();
    markerGroup.position.set(shop.x, groundHeightAt(shop.x, shop.z), shop.z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.25, 28),
      new THREE.MeshBasicMaterial({
        color: shop.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    markerGroup.add(ring);
    shopRings.push(ring);

    // Subtle open doorway glow pillar
    const portal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8),
      doorMat
    );
    portal.position.y = 1.6;
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshBasicMaterial({ color: shop.color })
    );
    beacon.position.y = 3.6;
    markerGroup.add(portal, beacon);

    scene.add(markerGroup);
  });

  // Mosque with Minaret
  addBuilding(-24, -28, 16, 8, 14, '#e7dccb', '#14532d');
  const minaret = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 20, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 0.78 })
  );
  minaret.position.set(-18, 10, -22);
  minaret.castShadow = true;
  scene.add(minaret);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45, metalness: 0.2 })
  );
  dome.position.set(-24, 8, -28);
  scene.add(dome);

  // 7) Djelfa Police Station (مركز الأمن الوطني · الشرطي جموعي)
  addBuilding(-24, -50, 15, 9.5, 12, '#cbd5e1', '#1e3a8a', {
    title: 'مركز الأمن الوطني · الشرطة 17',
    subtitle: 'الشرطي جموعي · أمن ولاية الجلفة',
    bg: '#0f172a',
    text: '#38bdf8',
    faceZ: 1,
  });

  const jomouiMarker = new THREE.Group();
  jomouiMarker.position.set(-12, groundHeightAt(-12, -42), -42);
  const jomouiRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.1, 28),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    })
  );
  jomouiRing.rotation.x = -Math.PI / 2;
  jomouiRing.position.y = 0.06;
  jomouiMarker.add(jomouiRing);
  shopRings.push(jomouiRing);
  scene.add(jomouiMarker);

  // Additional Djelfa Urban Blocks
  addBuilding(26, 24, 14, 12, 11, '#c5a57e', '#4b3b2c');
  addBuilding(-50, -48, 13, 9, 11, '#d7be9c', '#57534e');
  addBuilding(-56, 46, 14, 7.5, 12, '#9ca3af', '#374151');

  // 5. Mafia Compound
  const compoundX = 108;
  const compoundZ = -24;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });

  const addCompoundWall = (wx: number, wz: number, ww: number, wd: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 4.2, wd), wallMat);
    m.position.set(wx, 2.1, wz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({
      minX: wx - ww / 2,
      maxX: wx + ww / 2,
      minZ: wz - wd / 2,
      maxZ: wz + wd / 2,
    });
  };

  addCompoundWall(compoundX, compoundZ - 18, 36, 1.4);
  addCompoundWall(compoundX, compoundZ + 18, 36, 1.4);
  addCompoundWall(compoundX + 18, compoundZ, 1.4, 36);
  addCompoundWall(compoundX - 18, compoundZ - 11, 1.4, 14);
  addCompoundWall(compoundX - 18, compoundZ + 11, 1.4, 14);

  addBuilding(compoundX + 6, compoundZ - 5, 16, 7.5, 12, '#33363d', '#7f1d1d', {
    title: 'وكر المافيا المحصن',
    subtitle: 'منطقة محظورة · طريق عين وسارة',
    bg: '#1c0a0a',
    text: '#ef4444',
    faceZ: 1,
  });

  addBuilding(compoundX + 4, compoundZ + 10, 10, 4.8, 8, '#3f3f46', '#991b1b');
  const hostageDoorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 3.2, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.6,
      metalness: 0.6,
      roughness: 0.4,
    })
  );
  hostageDoorMesh.position.set(compoundX - 1.1, 1.6, compoundZ + 10);
  scene.add(hostageDoorMesh);

  // 6. InstancedMesh Senalba Aleppo Pines & Boulevard Palms
  const pineTrunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.6, 6);
  pineTrunkGeo.translate(0, 1.3, 0);
  const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.92 });

  const pineCrownGeo = new THREE.ConeGeometry(2.1, 5.4, 7);
  pineCrownGeo.translate(0, 4.6, 0);
  const pineCrownMat = new THREE.MeshStandardMaterial({ color: 0x2d4f2e, roughness: 0.85 });

  const pinePositions: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < 160; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 115 + Math.random() * 110;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    if (Math.abs(px) < 12 || Math.abs(pz) < 12) continue;
    pinePositions.push({ x: px, z: pz, s: 0.85 + Math.random() * 0.35 });
  }
  for (let i = 0; i < 65; i++) {
    const px = -65 - Math.random() * 85;
    const pz = -55 - Math.random() * 85;
    if (Math.hypot(px - -82, pz - -78) < 16) continue;
    pinePositions.push({ x: px, z: pz, s: 0.85 + Math.random() * 0.4 });
  }

  const pineTrunks = new THREE.InstancedMesh(pineTrunkGeo, pineTrunkMat, pinePositions.length);
  const pineCrowns = new THREE.InstancedMesh(pineCrownGeo, pineCrownMat, pinePositions.length);
  pineTrunks.castShadow = true;
  pineCrowns.castShadow = true;

  const dummy = new THREE.Object3D();
  const colorVar = new THREE.Color();
  pinePositions.forEach((p, idx) => {
    const y = groundHeightAt(p.x, p.z);
    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    pineTrunks.setMatrixAt(idx, dummy.matrix);
    pineCrowns.setMatrixAt(idx, dummy.matrix);

    colorVar.setHex(0x2d4f2e).offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.08);
    pineCrowns.setColorAt(idx, colorVar);
  });
  pineTrunks.instanceMatrix.needsUpdate = true;
  pineCrowns.instanceMatrix.needsUpdate = true;
  if (pineCrowns.instanceColor) pineCrowns.instanceColor.needsUpdate = true;
  pineTrunks.computeBoundingSphere();
  pineCrowns.computeBoundingSphere();
  scene.add(pineTrunks, pineCrowns);

  const palmPositions: Array<[number, number]> = [
    [-9, -16], [9, -16], [-9, 16], [9, 16],
    [-9, -45], [9, -45], [-9, 45], [9, 45],
    [-35, -9], [-35, 9], [35, -9], [35, 9],
  ];

  const palmTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 6.2, 7);
  palmTrunkGeo.translate(0, 3.1, 0);
  const palmLeafGeo = new THREE.ConeGeometry(2.2, 1.5, 6);
  palmLeafGeo.translate(0, 6.5, 0);

  const palmTrunks = new THREE.InstancedMesh(
    palmTrunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.9 }),
    palmPositions.length
  );
  const palmLeaves = new THREE.InstancedMesh(
    palmLeafGeo,
    new THREE.MeshStandardMaterial({ color: 0x3b6e38, roughness: 0.8 }),
    palmPositions.length
  );
  palmTrunks.castShadow = true;
  palmLeaves.castShadow = true;

  palmPositions.forEach(([px, pz], idx) => {
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(0, idx * 0.7, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(idx, dummy.matrix);
    palmLeaves.setMatrixAt(idx, dummy.matrix);
  });
  palmTrunks.instanceMatrix.needsUpdate = true;
  palmLeaves.instanceMatrix.needsUpdate = true;
  palmTrunks.computeBoundingSphere();
  palmLeaves.computeBoundingSphere();
  scene.add(palmTrunks, palmLeaves);

  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.5,
  });
  for (let z = -80; z <= 80; z += 32) {
    if (Math.abs(z) < 16) continue;
    for (const side of [-8.2, 8.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.5, 6), lampPoleMat);
      pole.position.set(side, 2.75, z);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.26), lampBulbMat);
      bulb.position.set(side > 0 ? side - 0.5 : side + 0.5, 5.5, z);
      scene.add(pole, bulb);
    }
  }

  const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xa17c58, roughness: 0.92 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 70);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.random() * 0.2;
    const r = 132 + Math.random() * 90;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    dummy.position.set(rx, groundHeightAt(rx, rz) + 0.5, rz);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.scale.set(0.8 + Math.random() * 1.4, 0.6 + Math.random() * 0.9, 0.8 + Math.random() * 1.4);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  scene.add(rocks);

  return { colliders, hostageDoorMesh, shopRings };
}
