import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoundEngine, VoiceSpeaker } from './audio';
import {
  CharacterModelRig,
  createCharacterModel,
  createVehicleModel,
  createWeaponMesh,
  VehicleModelRig,
} from './models';
import { SavedProgress, writeSavedProgress } from './saveSystem';
import { DISTRICT_NAMES, MISSIONS, SHOPS, VEHICLES, WEAPONS } from './storyData';
import { createContactShadowTexture } from './textures';
import {
  ChatChoice,
  GamePhase,
  HudState,
  JomouiOption,
  MinimapEntity,
  PortraitId,
  RadioMessage,
  ShopDefinition,
  ShopItem,
  VehicleKind,
  WeaponId,
} from './types';
import { buildDjelfaWorld, ColliderBox, groundHeightAt } from './worldBuilder';

const _camTarget = new THREE.Vector3();
const _camGoal = new THREE.Vector3();

interface CarEntity {
  id: string;
  kind: VehicleKind;
  rig: VehicleModelRig;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  hp: number;
  maxHp: number;
  plate: string;
  nameAr: string;
  maxSpeed: number;
  accel: number;
  turnSpeed: number;
  length: number;
  width: number;
}

interface ActorEntity {
  id: string;
  role: 'ally' | 'mafia' | 'boss' | 'informant' | 'police' | 'parent_father' | 'parent_mother';
  rig: CharacterModelRig;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shootCooldown: number;
  patrolCenterX: number;
  patrolCenterZ: number;
  missionTag: number;
  walkPhase: number;
}

interface BulletTracer {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  fromPlayer: boolean;
  damage: number;
}

interface PickupItem {
  id: string;
  kind: 'crate' | 'health' | 'ammo';
  mesh: THREE.Group;
  x: number;
  z: number;
  active: boolean;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
  gravity: number;
  active: boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onMissionComplete: (nextMissionIndex: number) => void;
  onVictory: (kills: number, cash: number) => void;
  onDefeat: () => void;
  onCallout: (text: string) => void;
  onRadioMessage: (msg: RadioMessage) => void;
  onOpenShop: (shop: ShopDefinition) => void;
  onOpenJomoui: () => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private sound = new SoundEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private muzzleLight!: THREE.PointLight;
  private shadowTex!: THREE.Texture;

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudTimer = 0;
  private ambientDust!: THREE.Points;

  private phase: GamePhase = 'title';
  private isFreeRoam = false;
  private colliders: ColliderBox[] = [];
  private hostageDoorMesh!: THREE.Mesh;
  private shopRings: THREE.Mesh[] = [];

  // Player state
  private playerRig!: CharacterModelRig;
  private playerX = 16;
  private playerZ = 62;
  private playerYaw = Math.PI;
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerArmor = 0;
  private playerCash = 5000;
  private playerWalkPhase = 0;
  private kills = 0;

  // Weapons
  private activeWeapon: WeaponId = 'beretta';
  private unlockedWeapons: Set<WeaponId> = new Set(['beretta']);
  private ammoInMag: Record<WeaponId, number> = { beretta: 15, ak47: 30, shotgun: 8 };
  private reserveAmmo: Record<WeaponId, number> = { beretta: 999, ak47: 150, shotgun: 40 };
  private fireCooldown = 0;
  private reloadTimer = 0;
  private isReloading = false;
  private hitMarkerTimer = 0;
  private damageFlashTimer = 0;
  private shakeIntensity = 0;

  // Vehicles & World Entities
  private cars: CarEntity[] = [];
  private drivenCar: CarEntity | null = null;
  private lastCar: CarEntity | null = null;
  private actors: ActorEntity[] = [];
  private tracers: BulletTracer[] = [];
  private pickups: PickupItem[] = [];
  private particles: PooledParticle[] = [];
  private dustEmitTimer = 0;
  private lastDistrict = '';

  // Mission & Waypoint
  private missionIndex = 0;
  private waypointGroup!: THREE.Group;
  private waypointRing!: THREE.Mesh;
  private convoyCrateCollected = false;

  // Camera & Input
  private camYaw = Math.PI;
  private camPitch = 0.28;
  private keys: Record<string, boolean> = {};
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private virtualInput = { forward: 0, turn: 0, shoot: false };

  private playerTracerGeo = new THREE.BoxGeometry(0.08, 0.08, 0.9);
  private playerTracerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  private enemyTracerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private particleGeo = new THREE.DodecahedronGeometry(0.22, 0);

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initScene();
    this.initParticlePool();
    this.bindEvents();
    this.spawnInitialWorld();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initScene() {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xcfa072);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xcfa072, 0.0046);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      62,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.2,
      450
    );

    const hemi = new THREE.HemisphereLight(0x9ec5e8, 0x8b6747, 0.72);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xffe1b5, 1.85);
    this.sunLight.position.set(45, 65, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 12, 2);
    this.scene.add(this.muzzleLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createContactShadowTexture();

    const worldData = buildDjelfaWorld(this.scene, maxAniso);
    this.colliders = worldData.colliders;
    this.hostageDoorMesh = worldData.hostageDoorMesh;
    this.shopRings = worldData.shopRings;

    const moteCount = 260;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 220;
      motePos[i * 3 + 1] = 0.8 + Math.random() * 14;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.24,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ambientDust = new THREE.Points(moteGeo, moteMat);
    this.scene.add(this.ambientDust);

    this.waypointGroup = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 18;
    this.waypointRing = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 2.3, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.waypointRing.rotation.x = -Math.PI / 2;
    this.waypointRing.position.y = 0.08;
    this.waypointGroup.add(beam, this.waypointRing);
    this.scene.add(this.waypointGroup);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initParticlePool() {
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scaleStart: 1,
        scaleEnd: 0.1,
        gravity: 0,
        active: false,
      });
    }
  }

  private emitParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    life: number,
    scaleStart: number,
    scaleEnd: number,
    gravity = 0
  ) {
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.life = life;
        p.maxLife = life;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.scaleStart = scaleStart;
        p.scaleEnd = scaleEnd;
        p.gravity = gravity;
        p.mat.color.setHex(color);
        p.mat.opacity = 0.85;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(scaleStart);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private emitBurst(x: number, y: number, z: number, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.8) * speed;
      this.emitParticle(
        x,
        y,
        z,
        Math.cos(a) * spd,
        1.5 + Math.random() * speed * 0.9,
        Math.sin(a) * spd,
        color,
        0.35 + Math.random() * 0.35,
        0.7 + Math.random() * 0.6,
        0.1,
        9.8
      );
    }
  }

  private spawnCar(id: string, kind: VehicleKind, x: number, z: number, yaw: number): CarEntity {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const spec = VEHICLES[kind];
    const rig = createVehicleModel(spec, maxAniso, this.shadowTex);
    rig.group.position.set(x, groundHeightAt(x, z), z);
    rig.group.rotation.y = yaw;
    this.scene.add(rig.group);
    const car: CarEntity = {
      id,
      kind,
      rig,
      x,
      z,
      yaw,
      speed: 0,
      steerAngle: 0,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      plate: spec.plate,
      nameAr: spec.nameAr,
      maxSpeed: spec.maxSpeed,
      accel: spec.accel,
      turnSpeed: spec.turnSpeed,
      length: spec.length,
      width: spec.width,
    };
    this.cars.push(car);
    return car;
  }

  private spawnInitialWorld() {
    this.playerRig = createCharacterModel('mosaab', this.shadowTex);
    this.playerRig.weaponMount.add(createWeaponMesh('beretta'));
    this.scene.add(this.playerRig.group);

    this.spawnCar('car_symbol_home', 'symbol', 11, 58, Math.PI);
    this.spawnCar('car_504_center', 'peugeot504', -10, -12, 0.2);
    this.spawnCar('car_hilux_gang', 'hilux', -64, 68, -0.4);
    this.spawnCar('car_golf_gang', 'golf7', -82, 66, 0.3);
    this.spawnCar('car_symbol_north', 'symbol', 10, -42, 0);
    this.spawnCar('car_police_djelfa', 'police_car', -9.5, -34, 0);
    this.spawnCar('car_mafia_east', 'mafia_suv', 84, -14, -Math.PI / 2);

    this.spawnActor('npc_informant', 'informant', 12, -18, 0.5, -1);
    this.spawnActor('npc_jomoui', 'police', -12, -42, Math.PI / 2, -1, 'beretta');
    this.spawnActor('npc_amir', 'ally', -76, 78, 0.2, -1);
    this.spawnActor('npc_father', 'parent_father', 112, -14, -Math.PI / 2, -1);
    this.spawnActor('npc_mother', 'parent_mother', 113, -12.5, -Math.PI / 2, -1);

    this.spawnPickup('hp_center', 'health', -13, 12);
    this.spawnPickup('hp_ind', 'health', -69, 75);
    this.spawnPickup('ammo_ind', 'ammo', -71, 79);
    this.spawnPickup('hp_east', 'health', 78, -6);
    this.spawnPickup('ammo_east', 'ammo', 82, -10);

    this.resetCampaignState(false);
  }

  private spawnActor(
    id: string,
    role: ActorEntity['role'],
    x: number,
    z: number,
    yaw: number,
    missionTag: number,
    weapon?: WeaponId
  ): ActorEntity {
    const rig = createCharacterModel(role, this.shadowTex);
    if (weapon) {
      rig.weaponMount.add(createWeaponMesh(weapon));
    }
    rig.group.position.set(x, groundHeightAt(x, z), z);
    rig.group.rotation.y = yaw;
    this.scene.add(rig.group);

    const maxHp = role === 'boss' ? 320 : role === 'mafia' ? 85 : 140;
    const actor: ActorEntity = {
      id,
      role,
      rig,
      x,
      z,
      yaw,
      hp: maxHp,
      maxHp,
      alive: true,
      shootCooldown: 0.8 + Math.random() * 0.8,
      patrolCenterX: x,
      patrolCenterZ: z,
      missionTag,
      walkPhase: 0,
    };
    this.actors.push(actor);
    return actor;
  }

  private spawnPickup(id: string, kind: PickupItem['kind'], x: number, z: number) {
    const g = new THREE.Group();
    const color = kind === 'crate' ? 0xf59e0b : kind === 'health' ? 0x10b981 : 0x3b82f6;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(
        kind === 'crate' ? 1.4 : 0.75,
        kind === 'crate' ? 0.9 : 0.55,
        kind === 'crate' ? 1.0 : 0.75
      ),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      })
    );
    box.position.y = 0.6;
    box.castShadow = true;
    g.add(box);
    g.position.set(x, groundHeightAt(x, z), z);
    this.scene.add(g);
    this.pickups.push({ id, kind, mesh: g, x, z, active: true });
  }

  public startNewGame(freeRoam: boolean) {
    this.resetCampaignState(freeRoam);
    if (freeRoam) {
      this.unlockedWeapons = new Set(['beretta', 'ak47', 'shotgun']);
      this.equipWeapon('ak47');
      this.playerCash = 50000;
      this.phase = 'playing';
      this.sendRadio(
        'عمير · صقور الهضاب',
        'ally',
        'مرحبا بيك في الجلفة 17 — كاع المحلات، نفطال، القاراج، والسبيطار مفتوحين ليك!'
      );
    } else {
      this.phase = 'briefing';
      this.saveNow(false);
    }
    this.pushHud();
  }

  public continueFromSave(save: SavedProgress) {
    this.resetCampaignState(false);
    this.missionIndex = THREE.MathUtils.clamp(save.missionIndex, 0, MISSIONS.length - 1);
    this.playerCash = save.cash ?? 5000;
    this.kills = save.kills ?? 0;
    this.playerHp = THREE.MathUtils.clamp(save.hp || 100, 35, 100);
    this.playerArmor = save.armor ?? 0;
    this.playerX = save.playerX ?? 16;
    this.playerZ = save.playerZ ?? 62;
    this.unlockedWeapons = new Set(
      save.unlockedWeapons && save.unlockedWeapons.length > 0 ? save.unlockedWeapons : ['beretta']
    );
    this.equipWeapon(this.unlockedWeapons.has(save.activeWeapon) ? save.activeWeapon : 'beretta');
    this.setupMissionSpawns(this.missionIndex);
    this.phase = 'playing';
    this.sendRadio(
      'مصعب',
      'mosaab',
      `كملنا من آخر حفظ — ${MISSIONS[this.missionIndex].title}. هيا نكملو!`
    );
    this.pushHud();
  }

  public saveNow(showToast = true): boolean {
    if (this.isFreeRoam) return false;
    const ok = writeSavedProgress({
      missionIndex: this.missionIndex,
      cash: this.playerCash,
      kills: this.kills,
      hp: Math.ceil(this.playerHp),
      armor: Math.ceil(this.playerArmor),
      unlockedWeapons: Array.from(this.unlockedWeapons),
      activeWeapon: this.activeWeapon,
      playerX: this.playerX,
      playerZ: this.playerZ,
      savedAt: new Date().toLocaleTimeString('ar-DZ'),
    });
    if (ok && showToast) {
      this.callbacks.onCallout('تم حفظ تقدمك بنجاح');
    }
    return ok;
  }

  public speakDialogueLine(text: string, portrait: PortraitId) {
    const speaker: VoiceSpeaker =
      portrait === 'ally'
        ? 'ally'
        : portrait === 'mafia'
        ? 'mafia'
        : portrait === 'jomoui'
        ? 'police'
        : portrait === 'cover'
        ? 'informant'
        : 'mosaab';
    this.sound.speakArabic(text, speaker);
  }

  public stopDialogueSpeech() {
    this.sound.stopSpeech();
  }

  public sendRadio(speaker: string, portrait: RadioMessage['portrait'], text: string) {
    this.callbacks.onRadioMessage({ speaker, portrait, text });
    this.speakDialogueLine(text, portrait);
  }

  public handleJomouiOption(opt: JomouiOption): string {
    switch (opt.action) {
      case 'vest':
        this.playerArmor = Math.min(100, this.playerArmor + 50);
        this.sound.playPickup();
        this.callbacks.onCallout('+50 سترة حماية من الشرطي جموعي');
        break;
      case 'ammo':
        this.ammoInMag.beretta = WEAPONS.beretta.magSize;
        this.reserveAmmo.ak47 += 60;
        this.reserveAmmo.shotgun += 16;
        this.sound.playPickup();
        this.callbacks.onCallout('تم تزويدك بالذخيرة من الشرطي جموعي');
        break;
      case 'heal':
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 45);
        this.sound.playPickup();
        this.callbacks.onCallout('+45 صحة');
        break;
      case 'car': {
        const px = -8.5;
        const pz = -36;
        this.spawnCar(`police_loan_${Date.now()}`, 'police_car', px, pz, 0);
        this.sound.playSirenChirp();
        this.emitBurst(px, 1.2, pz, 0x38bdf8, 12, 4.2);
        this.callbacks.onCallout('سيارة الشرطة DGSN 17 راهي واجدة قدامك!');
        break;
      }
      case 'intel':
        this.sound.playRadioBeep();
        this.callbacks.onCallout('تحريات جموعي: وكر المافيا شرقاً في طريق عين وسارة');
        break;
    }

    this.speakDialogueLine(opt.replyText, 'jomoui');
    this.saveNow(false);
    this.pushHud();
    return opt.replyText;
  }

  public applyChatChoice(choice: ChatChoice) {
    if (choice.rewardAction === 'ammo') {
      this.reserveAmmo.ak47 += 45;
      this.reserveAmmo.shotgun += 12;
      this.sound.playPickup();
    } else if (choice.rewardAction === 'heal') {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 35);
      this.sound.playPickup();
    }
    this.sendRadio(choice.replySpeaker, choice.replyPortrait, choice.replyText);
    this.pushHud();
  }

  public purchaseShopItem(shop: ShopDefinition, item: ShopItem): { ok: boolean; message: string } {
    if (this.playerCash < item.price) {
      return { ok: false, message: 'الدراهم ما يكفيوش! اضرب دوريات المافيا ولا كمل المهام.' };
    }

    const targetCar = this.drivenCar || this.lastCar || this.findNearestCar(18);

    if (
      (item.effect === 'repair_car' ||
        item.effect === 'turbo_car' ||
        item.effect.startsWith('paint_')) &&
      !targetCar
    ) {
      return { ok: false, message: 'قرب لوطو من المحل أولاً باش نخدموها!' };
    }

    if (item.effect === 'unlock_ak47' && this.unlockedWeapons.has('ak47')) {
      return { ok: false, message: 'راها عندك ديجا الكلاشينكوف!' };
    }
    if (item.effect === 'unlock_shotgun' && this.unlockedWeapons.has('shotgun')) {
      return { ok: false, message: 'راها عندك ديجا الفوزي شوتغن!' };
    }

    this.playerCash -= item.price;
    this.sound.playPickup();

    let msg = `تم: ${item.nameAr}`;
    switch (item.effect) {
      case 'heal_35':
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 35);
        msg = 'صحتك زادت +35!';
        break;
      case 'heal_100':
        this.playerHp = this.playerMaxHp;
        msg = 'صحتك رجعت 100%!';
        break;
      case 'armor_50':
        this.playerHp = this.playerMaxHp;
        this.playerArmor = Math.min(100, this.playerArmor + 50);
        msg = 'لبست درع حماية (+50 درع)!';
        break;
      case 'armor_100':
        this.playerArmor = 100;
        msg = 'سترة واقية كاملة 100%!';
        break;
      case 'ammo_all':
        this.reserveAmmo.ak47 += 120;
        this.reserveAmmo.shotgun += 32;
        this.ammoInMag.beretta = WEAPONS.beretta.magSize;
        msg = 'تعمرت كاع الذخيرة!';
        break;
      case 'unlock_ak47':
        this.unlockedWeapons.add('ak47');
        this.equipWeapon('ak47');
        this.reserveAmmo.ak47 += 90;
        msg = 'مبروك عليك الكلاشينكوف AK-47!';
        break;
      case 'unlock_shotgun':
        this.unlockedWeapons.add('shotgun');
        this.equipWeapon('shotgun');
        this.reserveAmmo.shotgun += 24;
        msg = 'مبروك عليك الفوزي شوتغن!';
        break;
      case 'repair_car':
        if (targetCar) {
          targetCar.hp = targetCar.maxHp;
          this.emitBurst(targetCar.x, 1.0, targetCar.z, 0x38bdf8, 10, 4);
          msg = `تصلحت ${targetCar.nameAr} 100%!`;
        }
        break;
      case 'turbo_car':
        if (targetCar) {
          targetCar.maxSpeed = Math.min(62, targetCar.maxSpeed * 1.25);
          targetCar.accel = Math.min(48, targetCar.accel * 1.25);
          this.emitBurst(targetCar.x, 1.0, targetCar.z, 0xf97316, 12, 4.5);
          msg = `ركب التوربو في ${targetCar.nameAr}!`;
        }
        break;
      case 'paint_white':
        targetCar?.rig.paintMat.color.setHex(0xf1f5f9);
        msg = 'اللوطو ولات بيضاء ناصعة!';
        break;
      case 'paint_blue':
        targetCar?.rig.paintMat.color.setHex(0x1d4ed8);
        msg = 'تصبغت باللون الأزرق الرياضي!';
        break;
      case 'paint_black':
        targetCar?.rig.paintMat.color.setHex(0x14161c);
        msg = 'تصبغت بالأسود الملكي!';
        break;
      case 'paint_taxi':
        targetCar?.rig.paintMat.color.setHex(0xeab308);
        msg = 'ولات بلون طاكسي الجلفة الأصفر!';
        break;
      case 'spawn_symbol':
        this.spawnCar(`buy_sym_${Date.now()}`, 'symbol', shop.x + 5, shop.z - 5, 0);
        msg = 'رونو سيمبول جديدة راها تستنى فيك قدام الباب!';
        break;
      case 'spawn_504':
        this.spawnCar(`buy_504_${Date.now()}`, 'peugeot504', shop.x + 4, shop.z + 5, 0);
        msg = 'بيجو 504 الخشينة راها قدام المحطة!';
        break;
      case 'spawn_hilux':
        this.spawnCar(`buy_hilux_${Date.now()}`, 'hilux', shop.x + 6, shop.z - 6, 0);
        msg = 'تويوتا هيلوكس 4×4 راها واجدة قدام القاراج!';
        break;
      case 'spawn_golf7':
        this.spawnCar(`buy_golf_${Date.now()}`, 'golf7', shop.x + 6, shop.z - 6, 0);
        msg = 'غولف 7 سيري مسخنة وتستنى فيك قدام الباب!';
        break;
      case 'info_tip':
        msg = 'المافيا دايرين باراج شرقاً وعندهم وكر محصن في طريق عين وسارة. جيب عمير ورجالو معاك!';
        break;
    }

    this.speakDialogueLine(msg, shop.category === 'cafe' ? 'cover' : 'ally');
    this.saveNow(false);
    this.pushHud();
    return { ok: true, message: msg };
  }

  private findNearestCar(maxDist: number): CarEntity | null {
    let best: CarEntity | null = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(this.playerX - c.x, this.playerZ - c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    if (phase !== 'playing') {
      this.sound.updateEngine(false, 0, false);
    }
  }

  public setMuted(muted: boolean) {
    this.sound.setMuted(muted);
  }

  private resetCampaignState(freeRoam: boolean) {
    this.isFreeRoam = freeRoam;
    this.missionIndex = freeRoam ? 5 : 0;
    this.playerX = 16;
    this.playerZ = 62;
    this.playerYaw = Math.PI;
    this.camYaw = Math.PI;
    this.playerHp = 100;
    this.playerArmor = 0;
    this.playerCash = 5000;
    this.kills = 0;
    this.drivenCar = null;
    this.lastCar = null;
    this.convoyCrateCollected = false;
    this.damageFlashTimer = 0;
    this.shakeIntensity = 0;
    this.lastDistrict = '';

    this.unlockedWeapons = new Set(['beretta']);
    this.ammoInMag = { beretta: 15, ak47: 30, shotgun: 8 };
    this.reserveAmmo = { beretta: 999, ak47: 150, shotgun: 40 };
    this.equipWeapon('beretta');

    this.actors = this.actors.filter((a) => {
      if (a.missionTag >= 0) {
        this.scene.remove(a.rig.group);
        return false;
      }
      a.alive = true;
      a.hp = a.maxHp;
      a.rig.group.visible = true;
      return true;
    });

    this.pickups = this.pickups.filter((p) => {
      if (p.kind === 'crate') {
        this.scene.remove(p.mesh);
        return false;
      }
      p.active = true;
      p.mesh.visible = true;
      return true;
    });

    this.hostageDoorMesh.visible = true;
    this.hostageDoorMesh.position.y = 1.6;

    const defaults = [
      { id: 'car_symbol_home', x: 11, z: 58, yaw: Math.PI },
      { id: 'car_504_center', x: -10, z: -12, yaw: 0.2 },
      { id: 'car_hilux_gang', x: -64, z: 68, yaw: -0.4 },
      { id: 'car_golf_gang', x: -82, z: 66, yaw: 0.3 },
      { id: 'car_symbol_north', x: 10, z: -42, yaw: 0 },
      { id: 'car_police_djelfa', x: -9.5, z: -34, yaw: 0 },
      { id: 'car_mafia_east', x: 84, z: -14, yaw: -Math.PI / 2 },
    ];
    defaults.forEach((d) => {
      const c = this.cars.find((car) => car.id === d.id);
      if (c) {
        c.x = d.x;
        c.z = d.z;
        c.yaw = d.yaw;
        c.speed = 0;
        c.hp = c.maxHp;
        c.rig.group.position.set(c.x, groundHeightAt(c.x, c.z), c.z);
        c.rig.group.rotation.y = c.yaw;
      }
    });

    this.setupMissionSpawns(this.missionIndex);
  }

  private setupMissionSpawns(idx: number) {
    this.actors = this.actors.filter((a) => {
      if (a.missionTag >= 0) {
        this.scene.remove(a.rig.group);
        return false;
      }
      return true;
    });

    if (idx === 2) {
      this.convoyCrateCollected = false;
      this.spawnActor('m3_1', 'mafia', -78, -74, 0.4, 2, 'beretta');
      this.spawnActor('m3_2', 'mafia', -86, -80, -0.5, 2, 'ak47');
      this.spawnActor('m3_3', 'mafia', -82, -85, 0.1, 2, 'beretta');
      this.spawnActor('m3_4', 'mafia', -74, -82, 1.2, 2, 'beretta');
      this.spawnPickup('mission_crate', 'crate', -82, -78);
    } else if (idx === 3) {
      this.spawnActor('m4_1', 'mafia', 60, -4, -Math.PI / 2, 3, 'ak47');
      this.spawnActor('m4_2', 'mafia', 62, 5, -Math.PI / 2, 3, 'beretta');
      this.spawnActor('m4_3', 'mafia', 67, 0, -Math.PI / 2, 3, 'ak47');
      this.spawnActor('m4_4', 'mafia', 65, -7, -Math.PI / 2, 3, 'beretta');
    } else if (idx === 4) {
      this.spawnActor('m5_ally_1', 'ally', 84, -20, Math.PI / 2, 4, 'ak47');
      this.spawnActor('m5_ally_2', 'ally', 84, -28, Math.PI / 2, 4, 'ak47');

      this.spawnActor('m5_g1', 'mafia', 95, -22, -Math.PI / 2, 4, 'ak47');
      this.spawnActor('m5_g2', 'mafia', 98, -28, -Math.PI / 2, 4, 'ak47');
      this.spawnActor('m5_g3', 'mafia', 105, -18, -Math.PI / 2, 4, 'shotgun');
      this.spawnActor('m5_g4', 'mafia', 110, -30, -Math.PI / 2, 4, 'ak47');
      this.spawnActor('m5_boss', 'boss', 104, -24, -Math.PI / 2, 4, 'ak47');
    } else if (idx === 5) {
      this.spawnActor('fr_1', 'mafia', 98, -22, 0, 5, 'ak47');
      this.spawnActor('fr_2', 'mafia', 104, -28, 0, 5, 'beretta');
      this.spawnActor('fr_3', 'mafia', -80, -76, 0, 5, 'ak47');
    }

    const mission = MISSIONS[idx];
    if (mission && mission.type !== 'free_roam') {
      this.waypointGroup.visible = true;
      const wx = mission.targetPos.x;
      const wz = mission.targetPos.z;
      this.waypointGroup.position.set(wx, groundHeightAt(wx, wz), wz);
    } else {
      this.waypointGroup.visible = false;
    }
  }

  public equipWeapon(weapon: WeaponId) {
    if (!this.unlockedWeapons.has(weapon)) return;
    this.activeWeapon = weapon;
    this.isReloading = false;
    while (this.playerRig.weaponMount.children.length > 0) {
      this.playerRig.weaponMount.remove(this.playerRig.weaponMount.children[0]);
    }
    this.playerRig.weaponMount.add(createWeaponMesh(weapon));
  }

  public triggerReload() {
    if (this.drivenCar || this.isReloading) return;
    const spec = WEAPONS[this.activeWeapon];
    if (this.ammoInMag[this.activeWeapon] >= spec.magSize) return;
    if (this.reserveAmmo[this.activeWeapon] <= 0) return;
    this.isReloading = true;
    this.reloadTimer = spec.reloadTime;
    this.sound.playReload();
  }

  private findNearbyShop(): ShopDefinition | null {
    for (const s of SHOPS) {
      if (Math.hypot(this.playerX - s.x, this.playerZ - s.z) < 5.6) {
        return s;
      }
    }
    return null;
  }

  public triggerInteract(mode: 'all' | 'car' | 'interact' = 'all') {
    if (this.phase !== 'playing') return;

    // 1) Story Mission Interactions (E)
    if (mode !== 'car') {
      const mission = MISSIONS[this.missionIndex];
      if (mission) {
        if (mission.type === 'reach_cafe' && Math.hypot(this.playerX - 12, this.playerZ - -18) < 6.5) {
          this.advanceMission();
          return;
        }
        if (mission.type === 'meet_ally' && Math.hypot(this.playerX - -76, this.playerZ - 78) < 6.5) {
          this.advanceMission();
          return;
        }
        if (mission.type === 'rescue_parents') {
          const bossAlive = this.actors.some((a) => a.role === 'boss' && a.alive);
          const distDoor = Math.hypot(this.playerX - 107, this.playerZ - -14);
          if (distDoor < 6.5) {
            if (bossAlive) {
              this.sendRadio('مصعب', 'mosaab', 'لازم نطيّح «الضبع» أولاً قبل ما نفتح الباب لوالديّ!');
              return;
            }
            this.hostageDoorMesh.visible = false;
            this.sound.playPickup();
            this.emitBurst(107, 2.0, -14, 0xfbbf24, 18, 6);
            this.phase = 'victory';
            this.saveNow(false);
            this.callbacks.onVictory(this.kills, this.playerCash + mission.rewardCash);
            return;
          }
        }
      }

      // 2) Talk to Officer Jomoui at the Police Station
      if (Math.hypot(this.playerX - -12, this.playerZ - -42) < 5.6) {
        this.sound.updateEngine(false, 0, false);
        this.phase = 'paused';
        this.callbacks.onOpenJomoui();
        return;
      }

      // 3) Open any nearby Shop or Service Center!
      const nearbyShop = this.findNearbyShop();
      if (nearbyShop) {
        this.sound.updateEngine(false, 0, false);
        this.phase = 'paused';
        this.callbacks.onOpenShop(nearbyShop);
        this.speakDialogueLine(nearbyShop.greetingAr, nearbyShop.category === 'cafe' ? 'cover' : 'ally');
        return;
      }
    }

    // 3) Exit or Enter Vehicle (F)
    if (this.drivenCar) {
      const car = this.drivenCar;
      this.lastCar = car;
      this.drivenCar = null;
      this.playerX = car.x - Math.cos(car.yaw) * (car.width * 0.9 + 0.8);
      this.playerZ = car.z + Math.sin(car.yaw) * (car.width * 0.9 + 0.8);
      this.playerRig.group.visible = true;
      this.sound.updateEngine(false, 0, false);
      return;
    }

    const bestCar = this.findNearestCar(4.6);
    if (bestCar) {
      this.drivenCar = bestCar;
      this.lastCar = bestCar;
      this.playerRig.group.visible = false;
      this.sound.startEngineLoop();
      this.callbacks.onCallout(`ركبت ${bestCar.nameAr} · ترقيم ${bestCar.plate}`);
    }
  }

  public triggerShoot() {
    if (this.phase !== 'playing' || this.drivenCar || this.isReloading) return;
    if (this.fireCooldown > 0) return;

    const spec = WEAPONS[this.activeWeapon];
    if (this.ammoInMag[this.activeWeapon] <= 0) {
      this.triggerReload();
      return;
    }

    this.ammoInMag[this.activeWeapon]--;
    this.fireCooldown = 1 / spec.fireRate;
    this.sound.playGunshot(this.activeWeapon);

    this.shakeIntensity = Math.max(
      this.shakeIntensity,
      this.activeWeapon === 'shotgun' ? 0.32 : this.activeWeapon === 'ak47' ? 0.12 : 0.08
    );

    this.playerYaw = this.camYaw + Math.PI;

    const muzzleX = this.playerX + Math.sin(this.playerYaw) * 0.72;
    const muzzleZ = this.playerZ + Math.cos(this.playerYaw) * 0.72;
    const muzzleY = groundHeightAt(this.playerX, this.playerZ) + 1.35;

    this.muzzleLight.position.set(muzzleX, muzzleY, muzzleZ);
    this.muzzleLight.intensity = 5.2;

    this.emitParticle(
      muzzleX,
      muzzleY,
      muzzleZ,
      Math.sin(this.playerYaw) * 4,
      0.8,
      Math.cos(this.playerYaw) * 4,
      0xfef08a,
      0.12,
      0.55,
      0.1
    );
    this.emitParticle(
      muzzleX,
      muzzleY,
      muzzleZ,
      Math.sin(this.playerYaw) * 2 + (Math.random() - 0.5),
      1.2,
      Math.cos(this.playerYaw) * 2,
      0x9ca3af,
      0.35,
      0.35,
      0.9
    );

    let aimYaw = this.playerYaw;
    let aimPitch = -this.camPitch * 0.35;
    let bestScore = 0.28;
    const forwardX = Math.sin(this.playerYaw);
    const forwardZ = Math.cos(this.playerYaw);

    for (const a of this.actors) {
      if (!a.alive || (a.role !== 'mafia' && a.role !== 'boss')) continue;
      const dx = a.x - muzzleX;
      const dz = a.z - muzzleZ;
      const dist = Math.hypot(dx, dz);
      if (dist > spec.range || dist < 0.5) continue;
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;
      const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      if (angle < bestScore) {
        bestScore = angle;
        aimYaw = Math.atan2(dx, dz);
        aimPitch = (groundHeightAt(a.x, a.z) + 1.2 - muzzleY) / dist;
      }
    }

    for (let p = 0; p < spec.pellets; p++) {
      const sy = aimYaw + (Math.random() - 0.5) * spec.spread;
      const sp = aimPitch + (Math.random() - 0.5) * spec.spread * 0.5;
      const vx = Math.sin(sy) * 78;
      const vy = sp * 78;
      const vz = Math.cos(sy) * 78;

      const mesh = new THREE.Mesh(this.playerTracerGeo, this.playerTracerMat);
      mesh.position.set(muzzleX, muzzleY, muzzleZ);
      mesh.rotation.y = sy;
      this.scene.add(mesh);
      this.tracers.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life: spec.range / 78,
        fromPlayer: true,
        damage: spec.damage,
      });
    }
  }

  public setVirtualInput(forward: number, turn: number, shoot: boolean) {
    this.virtualInput.forward = forward;
    this.virtualInput.turn = turn;
    this.virtualInput.shoot = shoot;
  }

  private advanceMission() {
    const completed = MISSIONS[this.missionIndex];
    if (completed) {
      this.playerCash += completed.rewardCash;
      if (completed.unlocksWeapon) {
        this.unlockedWeapons.add(completed.unlocksWeapon);
        this.equipWeapon(completed.unlocksWeapon);
      }
    }
    this.sound.playPickup();
    this.missionIndex++;
    if (this.missionIndex >= MISSIONS.length) {
      this.missionIndex = MISSIONS.length - 1;
    }
    this.setupMissionSpawns(this.missionIndex);
    this.saveNow(true);
    this.phase = 'briefing';
    this.callbacks.onMissionComplete(this.missionIndex);
  }

  private resolveColliderPush(x: number, z: number, radius: number): [number, number] {
    let nx = THREE.MathUtils.clamp(x, -210, 210);
    let nz = THREE.MathUtils.clamp(z, -210, 210);

    for (const b of this.colliders) {
      const cx = THREE.MathUtils.clamp(nx, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(nz, b.minZ, b.maxZ);
      const dx = nx - cx;
      const dz = nz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          nx += (dx / dist) * push;
          nz += (dz / dist) * push;
        } else {
          nx += radius;
        }
      }
    }
    return [nx, nz];
  }

  private bindEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
      if (this.phase !== 'playing') return;
      if (e.code === 'KeyF') {
        this.triggerInteract('car');
      } else if (e.code === 'KeyE') {
        this.triggerInteract('interact');
      } else if (e.code === 'KeyR') {
        this.triggerReload();
      } else if (e.code === 'Digit1') {
        this.equipWeapon('beretta');
      } else if (e.code === 'Digit2') {
        this.equipWeapon('ak47');
      } else if (e.code === 'Digit3') {
        this.equipWeapon('shotgun');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (this.phase !== 'playing') return;
      if (e.button === 0) {
        this.mouseDownLeft = true;
        this.triggerShoot();
      } else if (e.button === 2) {
        this.mouseDownRight = true;
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0) this.mouseDownLeft = false;
      if (e.button === 2) this.mouseDownRight = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.phase !== 'playing') return;
      if (document.pointerLockElement === this.renderer.domElement) {
        this.camYaw -= e.movementX * 0.0032;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0024, 0.05, 0.72);
      } else if (this.mouseDownRight || (!this.drivenCar && e.buttons === 2)) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.camYaw -= dx * 0.0055;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.05, 0.72);
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    this.renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    (this as unknown as { _unbind: () => void })._unbind = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      this.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      this.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
    };
  }

  private startLoop() {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this.update(dt, now * 0.001);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const t = 1 - p.life / p.maxLife;
      const scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
      p.mesh.scale.setScalar(scale);
      p.mat.opacity = 0.85 * (1 - t);
    }
  }

  private update(dt: number, elapsed: number) {
    if (this.waypointGroup.visible) {
      this.waypointRing.rotation.z = elapsed * 1.8;
      this.waypointRing.scale.setScalar(1 + Math.sin(elapsed * 3.5) * 0.08);
    }

    this.shopRings.forEach((r, idx) => {
      r.rotation.z = -elapsed * 1.2 + idx;
      r.scale.setScalar(1 + Math.sin(elapsed * 2.4 + idx) * 0.06);
    });

    const flashRed = Math.sin(elapsed * 14) > 0;
    this.cars.forEach((car) => {
      if (car.rig.policeLights && car.rig.policeLights.length === 2) {
        const [redBeacon, blueBeacon] = car.rig.policeLights;
        (redBeacon.material as THREE.MeshStandardMaterial).emissiveIntensity = flashRed ? 2.2 : 0.25;
        (blueBeacon.material as THREE.MeshStandardMaterial).emissiveIntensity = flashRed ? 0.25 : 2.2;
      }
    });

    if (this.ambientDust) {
      this.ambientDust.rotation.y = elapsed * 0.015;
    }

    this.updateParticles(dt);

    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 45);
    }
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    }
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.8);
    }

    if (this.phase === 'title' || this.phase === 'briefing') {
      const angle = elapsed * 0.14;
      this.camera.position.set(Math.cos(angle) * 46, 20, Math.sin(angle) * 46);
      this.camera.lookAt(0, 3, 0);
      return;
    }

    if (this.phase !== 'playing') return;

    if (this.keys['KeyQ']) this.camYaw += dt * 2.1;
    if (this.keys['KeyC']) this.camYaw -= dt * 2.1;

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const spec = WEAPONS[this.activeWeapon];
        const needed = spec.magSize - this.ammoInMag[this.activeWeapon];
        const take = Math.min(needed, this.reserveAmmo[this.activeWeapon]);
        this.ammoInMag[this.activeWeapon] += take;
        this.reserveAmmo[this.activeWeapon] -= take;
      }
    }

    if ((this.mouseDownLeft || this.virtualInput.shoot) && this.activeWeapon === 'ak47') {
      this.triggerShoot();
    }

    if (this.drivenCar) {
      this.updateDriving(dt);
    } else {
      this.updateOnFoot(dt);
    }

    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
    }

    const currentDistrict = this.getDistrictName(this.playerX, this.playerZ);
    if (currentDistrict !== this.lastDistrict) {
      if (this.lastDistrict !== '' && currentDistrict === DISTRICT_NAMES.mafia_compound) {
        this.sendRadio(
          'عمير · صقور الهضاب',
          'ally',
          'راك دخلت لمعقل المافيا في طريق عين وسارة! رد بالك وحط صبعك على الزناد!'
        );
      }
      this.lastDistrict = currentDistrict;
    }

    this.updateActors(dt);
    this.updateTracers(dt);
    this.updatePickups(dt, elapsed);
    this.checkMissionObjectives();

    const focusX = this.drivenCar ? this.drivenCar.x : this.playerX;
    const focusZ = this.drivenCar ? this.drivenCar.z : this.playerZ;
    this.sunLight.position.set(focusX + 45, 65, focusZ + 35);
    this.sunLight.target.position.set(focusX, 0, focusZ);

    this.hudTimer += dt;
    if (this.hudTimer >= 0.065) {
      this.hudTimer = 0;
      this.pushHud();
    }
  }

  private updateOnFoot(dt: number) {
    let forward = 0;
    let strafe = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;

    if (this.virtualInput.forward !== 0 || this.virtualInput.turn !== 0) {
      forward += this.virtualInput.forward;
      this.camYaw -= this.virtualInput.turn * dt * 2.2;
    }

    const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const moveSpeed = sprint ? 11.2 : 7.4;

    const camFwdX = -Math.sin(this.camYaw);
    const camFwdZ = -Math.cos(this.camYaw);
    const camRightX = Math.cos(this.camYaw);
    const camRightZ = -Math.sin(this.camYaw);

    let mx = camFwdX * forward + camRightX * strafe;
    let mz = camFwdZ * forward + camRightZ * strafe;
    const len = Math.hypot(mx, mz);

    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.playerX += mx * moveSpeed * dt;
      this.playerZ += mz * moveSpeed * dt;
      const [rx, rz] = this.resolveColliderPush(this.playerX, this.playerZ, 0.55);
      this.playerX = rx;
      this.playerZ = rz;

      const targetYaw = Math.atan2(mx, mz);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);

      this.playerWalkPhase += dt * (sprint ? 14 : 10);
      const swing = Math.sin(this.playerWalkPhase) * 0.55;
      this.playerRig.leftLeg.rotation.x = swing;
      this.playerRig.rightLeg.rotation.x = -swing;
      this.playerRig.leftArm.rotation.x = -swing * 0.6;
    } else {
      this.playerRig.leftLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.leftLeg.rotation.x, 0, 10, dt);
      this.playerRig.rightLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.rightLeg.rotation.x, 0, 10, dt);
      this.playerRig.leftArm.rotation.x = THREE.MathUtils.damp(this.playerRig.leftArm.rotation.x, 0, 10, dt);
    }

    this.playerRig.rightArm.rotation.x = -Math.PI / 2.2;

    const py = groundHeightAt(this.playerX, this.playerZ);
    this.playerRig.group.position.set(this.playerX, py, this.playerZ);
    this.playerRig.group.rotation.y = this.playerYaw;

    const camDist = 6.2;
    const camH = 2.45 + Math.sin(this.camPitch) * 2.5;
    _camTarget.set(this.playerX, py + 1.55, this.playerZ);
    _camGoal.set(
      this.playerX + Math.sin(this.camYaw) * camDist,
      py + camH,
      this.playerZ + Math.cos(this.camYaw) * camDist
    );

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camGoal.x, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camGoal.y, 12, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camGoal.z, 12, dt);
    this.camera.lookAt(_camTarget);

    if (Math.abs(this.camera.fov - 62) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 62, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateDriving(dt: number) {
    const car = this.drivenCar!;
    let throttle = 0;
    let steerInput = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steerInput += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steerInput -= 1;

    if (this.virtualInput.forward !== 0 || this.virtualInput.turn !== 0) {
      throttle += this.virtualInput.forward;
      steerInput -= this.virtualInput.turn;
    }

    const handbrake = !!this.keys['Space'];

    if (throttle !== 0) {
      car.speed += throttle * car.accel * dt;
    } else {
      car.speed = THREE.MathUtils.damp(car.speed, 0, 2.2, dt);
    }

    if (handbrake) {
      car.speed = THREE.MathUtils.damp(car.speed, 0, 5.2, dt);
    }

    car.speed = THREE.MathUtils.clamp(car.speed, -car.maxSpeed * 0.4, car.maxSpeed);

    const targetSteer = steerInput * 0.48;
    car.steerAngle = THREE.MathUtils.damp(car.steerAngle, targetSteer, 9, dt);
    car.rig.frontWheelPivots.forEach((p) => {
      p.rotation.y = car.steerAngle;
    });

    if (Math.abs(car.speed) > 0.4) {
      const dir = car.speed >= 0 ? 1 : -1;
      const speedFactor = Math.min(1, Math.abs(car.speed) / 8);
      car.yaw += steerInput * car.turnSpeed * speedFactor * dir * dt * (handbrake ? 1.35 : 1);
    }

    const prevX = car.x;
    const prevZ = car.z;
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;

    const [rx, rz] = this.resolveColliderPush(car.x, car.z, 1.8);
    if (Math.hypot(rx - car.x, rz - car.z) > 0.08) {
      if (Math.abs(car.speed) > 9) {
        this.sound.playCrash();
        this.shakeIntensity = 0.4;
        this.emitBurst(car.x, 0.8, car.z, 0xfbbf24, 6, 4);
      }
      car.speed *= -0.25;
      car.x = prevX;
      car.z = prevZ;
    } else {
      car.x = rx;
      car.z = rz;
    }

    if (Math.abs(car.speed) > 10) {
      for (const a of this.actors) {
        if (!a.alive || (a.role !== 'mafia' && a.role !== 'boss')) continue;
        if (Math.hypot(a.x - car.x, a.z - car.z) < 2.3) {
          a.hp -= Math.abs(car.speed) * 4.5;
          this.emitBurst(a.x, 1.0, a.z, 0xdc2626, 6, 3.5);
          if (a.hp <= 0) {
            this.killActor(a);
          }
        }
      }
    }

    const cy = groundHeightAt(car.x, car.z);
    car.rig.group.position.set(car.x, cy, car.z);
    car.rig.group.rotation.y = car.yaw;

    const wheelSpin = (car.speed * dt) / 0.36;
    car.rig.wheelMeshes.forEach((w) => {
      w.rotation.x += wheelSpin;
    });

    const drifting = handbrake || (Math.abs(steerInput) > 0.4 && Math.abs(car.speed) > 16);
    this.dustEmitTimer += dt;
    if (this.dustEmitTimer > 0.055 && Math.abs(car.speed) > 8) {
      this.dustEmitTimer = 0;
      const rearX = car.x - Math.sin(car.yaw) * (car.length * 0.42);
      const rearZ = car.z - Math.cos(car.yaw) * (car.length * 0.42);
      const puffColor = drifting ? 0x9ca3af : 0xc29b6c;
      this.emitParticle(
        rearX + (Math.random() - 0.5) * 1.1,
        cy + 0.25,
        rearZ + (Math.random() - 0.5) * 1.1,
        (Math.random() - 0.5) * 1.5,
        0.7 + Math.random() * 0.9,
        (Math.random() - 0.5) * 1.5,
        puffColor,
        0.48,
        0.55,
        1.65
      );

      if (car.hp < car.maxHp * 0.55) {
        const hoodX = car.x + Math.sin(car.yaw) * (car.length * 0.35);
        const hoodZ = car.z + Math.cos(car.yaw) * (car.length * 0.35);
        this.emitParticle(hoodX, cy + 1.1, hoodZ, 0, 2.2, 0, 0x374151, 0.7, 0.6, 1.8);
      }
    }

    this.playerX = car.x;
    this.playerZ = car.z;

    this.sound.updateEngine(true, car.speed / car.maxSpeed, drifting);

    this.camYaw = THREE.MathUtils.damp(this.camYaw, car.yaw + Math.PI, 4.5, dt);
    const chaseDist = 9.5 + (Math.abs(car.speed) / car.maxSpeed) * 2.2;
    _camTarget.set(car.x, cy + 1.5, car.z);
    _camGoal.set(
      car.x - Math.sin(car.yaw) * chaseDist,
      cy + 4.0,
      car.z - Math.cos(car.yaw) * chaseDist
    );
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camGoal.x, 7.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camGoal.y, 7.5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camGoal.z, 7.5, dt);
    this.camera.lookAt(_camTarget);

    const targetFov = 62 + (Math.abs(car.speed) / car.maxSpeed) * 14;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  private updateActors(dt: number) {
    for (const a of this.actors) {
      if (!a.alive) continue;

      if (a.role === 'informant' || a.role === 'parent_father' || a.role === 'parent_mother') {
        continue;
      }

      if (a.role === 'police') {
        let target: ActorEntity | null = null;
        let bestD = 38;
        for (const e of this.actors) {
          if (!e.alive || (e.role !== 'mafia' && e.role !== 'boss')) continue;
          const d = Math.hypot(e.x - a.x, e.z - a.z);
          if (d < bestD) {
            bestD = d;
            target = e;
          }
        }
        if (target) {
          a.yaw = Math.atan2(target.x - a.x, target.z - a.z);
          a.rig.group.rotation.y = a.yaw;
          a.rig.rightArm.rotation.x = -Math.PI / 2.2;
          a.shootCooldown -= dt;
          if (a.shootCooldown <= 0) {
            a.shootCooldown = 0.65;
            this.spawnActorTracer(a, target.x, target.z, true, 14);
          }
        } else {
          a.rig.rightArm.rotation.x = THREE.MathUtils.damp(a.rig.rightArm.rotation.x, 0, 8, dt);
        }
        continue;
      }

      if (a.role === 'ally') {
        if (a.missionTag < 0) continue;

        let target: ActorEntity | null = null;
        let bestD = 42;
        for (const e of this.actors) {
          if (!e.alive || (e.role !== 'mafia' && e.role !== 'boss')) continue;
          const d = Math.hypot(e.x - a.x, e.z - a.z);
          if (d < bestD) {
            bestD = d;
            target = e;
          }
        }
        if (target) {
          const dx = target.x - a.x;
          const dz = target.z - a.z;
          a.yaw = Math.atan2(dx, dz);
          a.rig.group.rotation.y = a.yaw;
          a.rig.rightArm.rotation.x = -Math.PI / 2.2;
          if (bestD > 16) {
            a.x += (dx / bestD) * 4.5 * dt;
            a.z += (dz / bestD) * 4.5 * dt;
            a.rig.group.position.set(a.x, groundHeightAt(a.x, a.z), a.z);
          }
          a.shootCooldown -= dt;
          if (a.shootCooldown <= 0) {
            a.shootCooldown = 0.65;
            this.spawnActorTracer(a, target.x, target.z, true, 12);
          }
        }
        continue;
      }

      const dx = this.playerX - a.x;
      const dz = this.playerZ - a.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 46) {
        a.yaw = Math.atan2(dx, dz);
        a.rig.group.rotation.y = a.yaw;
        a.rig.rightArm.rotation.x = -Math.PI / 2.2;

        if (dist > 13 && dist < 44) {
          const spd = a.role === 'boss' ? 4.4 : 3.7;
          a.x += (dx / dist) * spd * dt;
          a.z += (dz / dist) * spd * dt;
          const [rx, rz] = this.resolveColliderPush(a.x, a.z, 0.55);
          a.x = rx;
          a.z = rz;
          a.walkPhase += dt * 8;
          const s = Math.sin(a.walkPhase) * 0.45;
          a.rig.leftLeg.rotation.x = s;
          a.rig.rightLeg.rotation.x = -s;
        }
        a.rig.group.position.set(a.x, groundHeightAt(a.x, a.z), a.z);

        a.shootCooldown -= dt;
        if (a.shootCooldown <= 0 && dist < 38) {
          a.shootCooldown = a.role === 'boss' ? 0.45 : 1.05 + Math.random() * 0.6;
          this.spawnActorTracer(a, this.playerX, this.playerZ, false, a.role === 'boss' ? 11 : 7);
        }
      }
    }
  }

  private spawnActorTracer(
    actor: ActorEntity,
    tx: number,
    tz: number,
    friendly: boolean,
    damage: number
  ) {
    const sy = Math.atan2(tx - actor.x, tz - actor.z) + (Math.random() - 0.5) * 0.1;
    const mx = actor.x + Math.sin(sy) * 0.8;
    const mz = actor.z + Math.cos(sy) * 0.8;
    const my = groundHeightAt(actor.x, actor.z) + 1.35;

    const mesh = new THREE.Mesh(
      this.playerTracerGeo,
      friendly ? this.playerTracerMat : this.enemyTracerMat
    );
    mesh.position.set(mx, my, mz);
    mesh.rotation.y = sy;
    this.scene.add(mesh);

    this.tracers.push({
      mesh,
      vel: new THREE.Vector3(Math.sin(sy) * 56, 0, Math.cos(sy) * 56),
      life: 0.9,
      fromPlayer: friendly,
      damage,
    });
  }

  private updateTracers(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.position.addScaledVector(t.vel, dt);

      let hit = false;
      if (t.fromPlayer) {
        for (const a of this.actors) {
          if (!a.alive || (a.role !== 'mafia' && a.role !== 'boss')) continue;
          if (Math.hypot(t.mesh.position.x - a.x, t.mesh.position.z - a.z) < 0.85) {
            a.hp -= t.damage;
            this.hitMarkerTimer = 0.16;
            this.sound.playHit();
            this.emitBurst(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z, 0xef4444, 5, 3.2);
            if (a.hp <= 0) {
              this.killActor(a);
            }
            hit = true;
            break;
          }
        }
      } else {
        if (Math.hypot(t.mesh.position.x - this.playerX, t.mesh.position.z - this.playerZ) < 0.85) {
          if (this.drivenCar) {
            this.drivenCar.hp = Math.max(20, this.drivenCar.hp - t.damage * 0.5);
            this.emitBurst(t.mesh.position.x, 1.0, t.mesh.position.z, 0xfbbf24, 4, 3);
          } else {
            let hpDamage = t.damage;
            if (this.playerArmor > 0) {
              const absorbed = Math.min(this.playerArmor, t.damage * 0.75);
              this.playerArmor -= absorbed;
              hpDamage -= absorbed;
            }
            this.playerHp -= hpDamage;
            this.damageFlashTimer = 0.25;
            this.shakeIntensity = 0.22;
            if (this.playerHp <= 0) {
              this.playerHp = 0;
              this.phase = 'defeat';
              this.sound.updateEngine(false, 0, false);
              this.callbacks.onDefeat();
            }
          }
          hit = true;
        }
      }

      if (hit || t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
  }

  private killActor(a: ActorEntity) {
    a.alive = false;
    a.rig.group.visible = false;
    this.kills++;
    this.playerCash += a.role === 'boss' ? 25000 : 2500;
    if (a.role === 'boss') {
      this.sound.playExplosion();
      this.shakeIntensity = 0.55;
      this.emitBurst(a.x, 1.2, a.z, 0xf97316, 18, 7);
      this.sendRadio(
        'مصعب',
        'mosaab',
        'طيّحت «الضبع»! دوكا نفتح الباب ونرجّع الوالد والوالدة!'
      );
    }
  }

  private updatePickups(dt: number, elapsed: number) {
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.position.y = groundHeightAt(p.x, p.z) + Math.sin(elapsed * 2.5) * 0.15;

      if (Math.hypot(this.playerX - p.x, this.playerZ - p.z) < 2.4) {
        p.active = false;
        p.mesh.visible = false;
        this.sound.playPickup();
        this.emitBurst(p.x, 1.0, p.z, 0x34d399, 10, 4);
        if (p.kind === 'health') {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 45);
          this.callbacks.onCallout('صحيت! +45 صحة');
        } else if (p.kind === 'ammo') {
          this.reserveAmmo.ak47 += 60;
          this.reserveAmmo.shotgun += 16;
          this.callbacks.onCallout('تعمرت الذخيرة!');
        } else if (p.kind === 'crate') {
          this.convoyCrateCollected = true;
          this.sendRadio('عمير · صقور الهضاب', 'ally', 'هايل! ديت كيسة السلاح، زيد نقّي اللي بقاو في سنلباء!');
        }
      }
    }
  }

  private checkMissionObjectives() {
    if (this.isFreeRoam) return;
    const mission = MISSIONS[this.missionIndex];
    if (!mission) return;

    if (mission.type === 'ambush_convoy') {
      const mafiaLeft = this.actors.some((a) => a.missionTag === 2 && a.alive);
      if (!mafiaLeft && this.convoyCrateCollected) {
        this.advanceMission();
      }
    } else if (mission.type === 'clear_checkpoint') {
      const mafiaLeft = this.actors.some((a) => a.missionTag === 3 && a.alive);
      if (!mafiaLeft) {
        this.advanceMission();
      }
    }
  }

  private getDistrictName(x: number, z: number): string {
    if (x > 80 && z < 0) return DISTRICT_NAMES.mafia_compound;
    if (x < -48 && z > 42) return DISTRICT_NAMES.industrial;
    if (x < -45 && z < -45) return DISTRICT_NAMES.senalba;
    if (x > -5 && z > 42) return DISTRICT_NAMES.moussala;
    return DISTRICT_NAMES.center;
  }

  private computeInteractionPrompt(): string | null {
    const mission = MISSIONS[this.missionIndex];

    if (!this.drivenCar) {
      if (mission?.type === 'reach_cafe' && Math.hypot(this.playerX - 12, this.playerZ - -18) < 6.5) {
        return 'اضغط E باش تهدر مع المخبر في القهوة';
      }
      if (mission?.type === 'meet_ally' && Math.hypot(this.playerX - -76, this.playerZ - 78) < 6.5) {
        return 'اضغط E باش تقابل عمير (شاف صقور الهضاب)';
      }
      if (mission?.type === 'rescue_parents' && Math.hypot(this.playerX - 107, this.playerZ - -14) < 6.5) {
        return 'اضغط E باش تحرر والديك!';
      }
    }

    if (Math.hypot(this.playerX - -12, this.playerZ - -42) < 5.6) {
      return 'اضغط E باش تهدر مع الشرطي جموعي';
    }

    const nearbyShop = this.findNearbyShop();
    if (nearbyShop) {
      return `اضغط E باش تدخل لـ ${nearbyShop.nameAr}`;
    }

    if (this.drivenCar) return 'اضغط F باش تهبط من اللوطو';

    const c = this.findNearestCar(4.5);
    if (c) {
      return `اضغط F باش تركب ${c.nameAr} (${c.plate})`;
    }
    return null;
  }

  private pushHud() {
    const mission = MISSIONS[this.missionIndex] || MISSIONS[MISSIONS.length - 1];
    let progressText = '';
    if (mission.type === 'ambush_convoy') {
      const left = this.actors.filter((a) => a.missionTag === 2 && a.alive).length;
      progressText = `أعداء باقيين: ${left} · الكيسة: ${this.convoyCrateCollected ? 'مرفودة' : 'مازال'}`;
    } else if (mission.type === 'clear_checkpoint') {
      const left = this.actors.filter((a) => a.missionTag === 3 && a.alive).length;
      progressText = `حراس الحاجز: ${left}`;
    } else if (mission.type === 'rescue_parents') {
      const left = this.actors.filter((a) => a.missionTag === 4 && (a.role === 'mafia' || a.role === 'boss') && a.alive).length;
      progressText = `المافيا في الوكر: ${left}`;
    }

    const entities: MinimapEntity[] = [];
    SHOPS.forEach((s) => {
      entities.push({ x: s.x, z: s.z, kind: 'shop' });
    });
    this.cars.forEach((c) => {
      if (c !== this.drivenCar) entities.push({ x: c.x, z: c.z, kind: 'car' });
    });
    this.actors.forEach((a) => {
      if (!a.alive) return;
      if (a.role === 'mafia') entities.push({ x: a.x, z: a.z, kind: 'enemy' });
      else if (a.role === 'boss') entities.push({ x: a.x, z: a.z, kind: 'boss' });
      else if (a.role === 'ally') entities.push({ x: a.x, z: a.z, kind: 'ally' });
      else if (a.role === 'police') entities.push({ x: a.x, z: a.z, kind: 'police' });
    });
    this.pickups.forEach((p) => {
      if (p.active && p.kind === 'crate') entities.push({ x: p.x, z: p.z, kind: 'crate' });
    });

    const mafiaNearby = this.actors.some(
      (a) => a.alive && (a.role === 'mafia' || a.role === 'boss') && Math.hypot(a.x - this.playerX, a.z - this.playerZ) < 42
    );

    this.callbacks.onHudUpdate({
      hp: Math.ceil(this.playerHp),
      maxHp: this.playerMaxHp,
      armor: Math.ceil(this.playerArmor),
      cash: this.playerCash,
      wantedLevel: mafiaNearby ? 2 : 0,
      districtName: this.getDistrictName(this.playerX, this.playerZ),
      inVehicle: !!this.drivenCar,
      vehicleName: this.drivenCar ? this.drivenCar.nameAr : '',
      vehiclePlate: this.drivenCar ? this.drivenCar.plate : '',
      vehicleHp: this.drivenCar ? Math.ceil(this.drivenCar.hp) : 0,
      vehicleMaxHp: this.drivenCar ? this.drivenCar.maxHp : 1,
      speedKmh: this.drivenCar ? Math.round(Math.abs(this.drivenCar.speed) * 3.6) : 0,
      activeWeapon: this.activeWeapon,
      unlockedWeapons: Array.from(this.unlockedWeapons),
      ammoInMag: { ...this.ammoInMag },
      reserveAmmo: { ...this.reserveAmmo },
      isReloading: this.isReloading,
      missionIndex: this.missionIndex,
      missionTitle: mission.title,
      missionObjective: mission.objectiveText,
      missionProgressText: progressText,
      interactionPrompt: this.computeInteractionPrompt(),
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerYaw: this.drivenCar ? this.drivenCar.yaw : this.playerYaw,
      targetX: mission.type === 'free_roam' ? null : mission.targetPos.x,
      targetZ: mission.type === 'free_roam' ? null : mission.targetPos.z,
      minimapEntities: entities,
      isFreeRoam: this.isFreeRoam,
      kills: this.kills,
      hitMarkerTimer: this.hitMarkerTimer,
      damageFlashTimer: this.damageFlashTimer,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const unbind = (this as unknown as { _unbind?: () => void })._unbind;
    if (unbind) unbind();
    this.sound.dispose();

    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
