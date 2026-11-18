import * as THREE from 'three';
import { createAlgerianPlateTexture } from './textures';
import { VehicleSpec, WeaponId } from './types';

export interface VehicleModelRig {
  group: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  frontWheelPivots: THREE.Group[];
  headlights: THREE.Mesh[];
  paintMat: THREE.MeshPhysicalMaterial;
  policeLights?: THREE.Mesh[];
}

export interface CharacterModelRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponMount: THREE.Group;
}

export function createWeaponMesh(weapon: WeaponId): THREE.Group {
  const g = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x22262d,
    metalness: 0.85,
    roughness: 0.3,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b3e22,
    metalness: 0.05,
    roughness: 0.72,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    metalness: 0.2,
    roughness: 0.75,
  });

  if (weapon === 'beretta') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.26), darkMetal);
    slide.position.set(0, 0.04, 0.08);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.13, 0.07), polymerMat);
    grip.position.set(0, -0.04, -0.01);
    grip.rotation.x = 0.22;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, 0.22);
    g.add(slide, grip, barrel);
  } else if (weapon === 'ak47') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.38), darkMetal);
    receiver.position.set(0, 0.03, 0.12);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.42, 8), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, 0.48);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.1, 0.24), woodMat);
    stock.position.set(0, 0.0, -0.16);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.22), woodMat);
    handguard.position.set(0, 0.025, 0.34);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.075), darkMetal);
    mag.position.set(0, -0.09, 0.16);
    mag.rotation.x = -0.32;
    g.add(receiver, barrel, stock, handguard, mag);
  } else {
    // Shotgun
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.36), darkMetal);
    body.position.set(0, 0.03, 0.1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.5, 10), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, 0.46);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 8), polymerMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, 0.01, 0.36);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.26), polymerMat);
    stock.position.set(0, -0.005, -0.18);
    g.add(body, barrel, pump, stock);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
    }
  });
  return g;
}

export function createVehicleModel(
  spec: VehicleSpec,
  maxAniso: number,
  shadowTex: THREE.Texture
): VehicleModelRig {
  const group = new THREE.Group();
  const wheelMeshes: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const headlights: THREE.Mesh[] = [];
  const policeLights: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: spec.bodyColor,
    metalness: 0.45,
    roughness: 0.26,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    metalness: 0.3,
    roughness: 0.65,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.92,
    roughness: 0.16,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.78,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15171c,
    metalness: 0.05,
    roughness: 0.88,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.88,
    roughness: 0.22,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfde68a,
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  });

  const halfW = spec.width / 2;
  const halfL = spec.length / 2;
  const isPickup = spec.kind === 'hilux';
  const isSuv = spec.kind === 'mafia_suv';
  const isHatch = spec.kind === 'golf7';
  const rideHeight = isPickup || isSuv ? 0.48 : 0.34;

  // 1. Sculpted side-profile extruded main lower chassis
  const profile = new THREE.Shape();
  profile.moveTo(-halfL, rideHeight);
  profile.lineTo(halfL, rideHeight);
  profile.lineTo(halfL, rideHeight + (isPickup || isSuv ? 0.66 : 0.56));
  profile.lineTo(halfL - 0.85, rideHeight + (isPickup || isSuv ? 0.74 : 0.62));
  profile.lineTo(halfL - 1.35, rideHeight + (isPickup || isSuv ? 1.32 : 1.14));
  if (isPickup) {
    profile.lineTo(-0.35, rideHeight + 1.32);
    profile.lineTo(-0.45, rideHeight + 0.76);
    profile.lineTo(-halfL, rideHeight + 0.76);
  } else if (isSuv || isHatch) {
    profile.lineTo(-halfL + 0.42, rideHeight + (isSuv ? 1.32 : 1.16));
    profile.lineTo(-halfL + 0.08, rideHeight + (isSuv ? 0.76 : 0.68));
    profile.lineTo(-halfL, rideHeight + 0.62);
  } else {
    // Classic sedan (Symbol / Peugeot 504)
    profile.lineTo(-halfL + 1.05, rideHeight + 1.14);
    profile.lineTo(-halfL + 0.62, rideHeight + 0.68);
    profile.lineTo(-halfL, rideHeight + 0.64);
  }
  profile.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: spec.width - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -(spec.width - 0.14) / 2);
  // Rotate so +Z is forward
  bodyGeo.rotateY(-Math.PI / 2);

  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Front & Rear Bumpers
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width + 0.04, 0.24, 0.22),
    spec.kind === 'peugeot504' ? chromeMat : trimMat
  );
  frontBumper.position.set(0, rideHeight + 0.14, halfL + 0.04);
  frontBumper.castShadow = true;
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width + 0.04, 0.24, 0.22),
    spec.kind === 'peugeot504' ? chromeMat : trimMat
  );
  rearBumper.position.set(0, rideHeight + 0.14, -halfL - 0.04);
  rearBumper.castShadow = true;
  group.add(rearBumper);

  // 3. Windshield & Side Windows
  const cabinTopY = rideHeight + (isPickup || isSuv ? 1.32 : 1.14);
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width - 0.28, 0.56, 0.06),
    glassMat
  );
  windshield.position.set(0, cabinTopY - 0.26, halfL - 1.12);
  windshield.rotation.x = -0.62;
  group.add(windshield);

  const sideGlassLen = isPickup ? 1.45 : isSuv || isHatch ? 2.15 : 1.75;
  const sideGlass = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width - 0.06, 0.42, sideGlassLen),
    glassMat
  );
  sideGlass.position.set(0, cabinTopY - 0.26, isPickup ? 0.35 : -0.15);
  group.add(sideGlass);

  // 4. Grille + Headlights + Taillights
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.54, 0.24, 0.08),
    spec.kind === 'peugeot504' ? chromeMat : trimMat
  );
  grille.position.set(0, rideHeight + 0.38, halfL + 0.05);
  group.add(grille);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
    hl.position.set(side * (halfW - 0.26), rideHeight + 0.42, halfL + 0.04);
    group.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tl.position.set(side * (halfW - 0.26), rideHeight + 0.44, -halfL - 0.04);
    group.add(tl);

    // Side mirrors
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.14), trimMat);
    mirror.position.set(side * (halfW + 0.06), rideHeight + 0.68, halfL - 1.25);
    group.add(mirror);
  }

  // 5. Algerian 17 (Djelfa) License Plates (White front, Yellow rear)
  const frontPlateMat = new THREE.MeshBasicMaterial({
    map: createAlgerianPlateTexture(maxAniso, spec.plate, false),
  });
  const rearPlateMat = new THREE.MeshBasicMaterial({
    map: createAlgerianPlateTexture(maxAniso, spec.plate, true),
  });
  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), frontPlateMat);
  frontPlate.position.set(0, rideHeight + 0.18, halfL + 0.16);
  group.add(frontPlate);

  const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), rearPlateMat);
  rearPlate.position.set(0, rideHeight + 0.2, -halfL - 0.16);
  rearPlate.rotation.y = Math.PI;
  group.add(rearPlate);

  // 6. Vehicle-specific iconic details
  if (isPickup) {
    // Hilux rollbar & LED roof bar & spare wheel in bed
    const rollBar = new THREE.Mesh(new THREE.TorusGeometry(halfW - 0.22, 0.055, 8, 16, Math.PI), trimMat);
    rollBar.position.set(0, rideHeight + 0.78, -0.52);
    group.add(rollBar);

    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.72, 0.08, 0.12), headMat);
    lightBar.position.set(0, cabinTopY + 0.08, 0.85);
    group.add(lightBar);

    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 16), tireMat);
    spareTire.position.set(0, rideHeight + 0.84, -1.35);
    group.add(spareTire);
  } else if (isHatch) {
    // Golf 7 sporty rear spoiler & dual exhaust
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.24, 0.07, 0.26), trimMat);
    spoiler.position.set(0, cabinTopY + 0.04, -halfL + 0.22);
    group.add(spoiler);
  } else if (isSuv) {
    // Mafia SUV bullbar & crimson stripe
    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.64, 0.34, 0.14), trimMat);
    bullbar.position.set(0, rideHeight + 0.32, halfL + 0.18);
    group.add(bullbar);
  } else if (spec.kind === 'symbol') {
    // Renault Symbol roof taxi/city antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.32, 6), trimMat);
    ant.position.set(0, cabinTopY + 0.16, -0.6);
    ant.rotation.x = -0.35;
    group.add(ant);
  } else if (spec.kind === 'peugeot504') {
    // Classic roof rack
    const rack = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.4, 0.06, 1.3), chromeMat);
    rack.position.set(0, cabinTopY + 0.07, -0.1);
    group.add(rack);
  } else if (spec.kind === 'police_car') {
    // Algerian DGSN blue side livery stripe & red/blue roof lightbar
    const policeBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.35,
      roughness: 0.35,
    });
    const sideStripe = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 0.02, 0.16, spec.length * 0.68),
      policeBlueMat
    );
    sideStripe.position.set(0, rideHeight + 0.38, 0);
    group.add(sideStripe);

    const hoodStripe = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.52, 0.03, 0.9),
      policeBlueMat
    );
    hoodStripe.position.set(0, rideHeight + 0.61, halfL - 0.65);
    group.add(hoodStripe);

    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.64, 0.07, 0.24),
      trimMat
    );
    barBase.position.set(0, cabinTopY + 0.06, -0.1);
    group.add(barBase);

    const redMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const redBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.2), redMat);
    redBeacon.position.set(-0.3, cabinTopY + 0.13, -0.1);
    const blueBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.2), blueMat);
    blueBeacon.position.set(0.3, cabinTopY + 0.13, -0.1);
    group.add(redBeacon, blueBeacon);
    policeLights.push(redBeacon, blueBeacon);
  }

  // 7. 4 Articulated Wheels (Bottom sits at y = 0!)
  const wheelRadius = isPickup || isSuv ? 0.44 : 0.34;
  const wheelWidth = 0.24;
  const wheelZFront = halfL - 0.82;
  const wheelZRear = -halfL + 0.82;
  const wheelX = halfW - 0.04;

  const wheelCoords: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: -wheelX, z: wheelZFront, isFront: true },
    { x: wheelX, z: wheelZFront, isFront: true },
    { x: -wheelX, z: wheelZRear, isFront: false },
    { x: wheelX, z: wheelZRear, isFront: false },
  ];

  wheelCoords.forEach(({ x, z, isFront }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, wheelRadius, z);

    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18),
      tireMat
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, wheelWidth + 0.02, 12),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;

    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(wheelWidth + 0.04, wheelRadius * 0.9, 0.06),
      trimMat
    );

    spinGroup.add(tire, rim, hub);
    pivot.add(spinGroup);
    group.add(pivot);

    wheelMeshes.push(spinGroup);
    if (isFront) {
      frontWheelPivots.push(pivot);
    }
  });

  // 8. Soft Radial Contact Shadow Plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.45, spec.length * 1.25),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  return {
    group,
    wheelMeshes,
    frontWheelPivots,
    headlights,
    paintMat,
    policeLights: policeLights.length > 0 ? policeLights : undefined,
  };
}

export function createCharacterModel(
  role: 'mosaab' | 'ally' | 'mafia' | 'boss' | 'informant' | 'police' | 'parent_father' | 'parent_mother',
  shadowTex: THREE.Texture
): CharacterModelRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: role === 'boss' ? 0xd4a98c : 0xc6926e,
    roughness: 0.72,
    metalness: 0.02,
  });

  const jacketColor =
    role === 'mosaab'
      ? 0x3f4a32
      : role === 'ally'
      ? 0x452b1d
      : role === 'boss'
      ? 0x111318
      : role === 'mafia'
      ? 0x1f242d
      : role === 'informant'
      ? 0x334155
      : role === 'police'
      ? 0x111c33
      : role === 'parent_father'
      ? 0xa89274
      : 0x6b2d46;

  const torsoMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.8,
    metalness: 0.08,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: role === 'boss' || role === 'mafia' ? 0x14171d : role === 'police' ? 0x0f172a : 0x263142,
    roughness: 0.85,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: role === 'parent_father' || role === 'boss' ? 0x9ca3af : 0x171717,
    roughness: 0.9,
  });

  // Legs (0 -> 0.85m)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.85, 0);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.2), pantsMat);
  lLegMesh.position.y = -0.425;
  lLegMesh.castShadow = true;
  leftLeg.add(lLegMesh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.85, 0);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.2), pantsMat);
  rLegMesh.position.y = -0.425;
  rLegMesh.castShadow = true;
  rightLeg.add(rLegMesh);

  // Torso (0.85 -> 1.48m)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.28), torsoMat);
  torso.position.y = 1.17;
  torso.castShadow = true;

  // Accent scarf / tie / hoodie collar
  const accentMat = new THREE.MeshStandardMaterial({
    color:
      role === 'mosaab'
        ? 0x18181b
        : role === 'ally'
        ? 0xd97706
        : role === 'boss'
        ? 0x991b1b
        : role === 'police'
        ? 0x38bdf8
        : 0x374151,
    roughness: 0.7,
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.14, 10), accentMat);
  collar.position.y = 1.5;

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.68;
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), hairMat);
  hair.position.y = 1.84;

  // Boss sunglasses, police cap + silver badge, or parent headscarf
  if (role === 'boss' || role === 'mafia') {
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1 })
    );
    shades.position.set(0, 1.71, 0.14);
    group.add(shades);
  } else if (role === 'police') {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 })
    );
    badge.position.set(0.12, 1.28, 0.15);
    const capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.32), torsoMat);
    capCrown.position.set(0, 1.88, 0);
    const capBand = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.04, 0.33), accentMat);
    capBand.position.set(0, 1.83, 0);
    const capVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4 })
    );
    capVisor.position.set(0, 1.82, 0.2);
    group.add(badge, capCrown, capBand, capVisor);
  } else if (role === 'parent_mother') {
    const hijab = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.31), accentMat);
    hijab.position.y = 1.7;
    group.add(hijab);
  }

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.34, 1.42, 0);
  const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.16), torsoMat);
  lArmMesh.position.y = -0.26;
  lArmMesh.castShadow = true;
  leftArm.add(lArmMesh);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.42, 0);
  const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.16), torsoMat);
  rArmMesh.position.y = -0.26;
  rArmMesh.castShadow = true;
  rightArm.add(rArmMesh);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.5, 0.1);
  weaponMount.rotation.x = -Math.PI / 2;
  rightArm.add(weaponMount);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;

  group.add(leftLeg, rightLeg, torso, collar, head, hair, leftArm, rightArm, shadow);

  if (role === 'boss') {
    group.scale.setScalar(1.14);
  }

  return { group, leftLeg, rightLeg, leftArm, rightArm, weaponMount };
}
