export type GamePhase =
  | 'title'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'victory'
  | 'defeat';

export type VehicleKind =
  | 'symbol'
  | 'peugeot504'
  | 'hilux'
  | 'golf7'
  | 'mafia_suv'
  | 'police_car';

export type WeaponId = 'beretta' | 'ak47' | 'shotgun';

export type DistrictId =
  | 'moussala'
  | 'center'
  | 'senalba'
  | 'industrial'
  | 'mafia_compound';

export type ShopCategory =
  | 'cafe'
  | 'grocery'
  | 'garage'
  | 'weapons'
  | 'naftal'
  | 'clinic';

export interface ShopItem {
  id: string;
  nameAr: string;
  descAr: string;
  price: number;
  effect:
    | 'heal_35'
    | 'heal_100'
    | 'armor_50'
    | 'armor_100'
    | 'ammo_all'
    | 'unlock_ak47'
    | 'unlock_shotgun'
    | 'repair_car'
    | 'turbo_car'
    | 'paint_white'
    | 'paint_blue'
    | 'paint_black'
    | 'paint_taxi'
    | 'spawn_symbol'
    | 'spawn_504'
    | 'spawn_hilux'
    | 'spawn_golf7'
    | 'info_tip';
}

export interface ShopDefinition {
  id: string;
  category: ShopCategory;
  nameAr: string;
  keeperName: string;
  greetingAr: string;
  x: number;
  z: number;
  color: number;
  items: ShopItem[];
}

export interface JomouiOption {
  id: string;
  titleAr: string;
  descAr: string;
  replyText: string;
  action: 'intel' | 'vest' | 'car' | 'ammo' | 'heal';
}

export interface WeaponSpec {
  id: WeaponId;
  nameAr: string;
  damage: number;
  fireRate: number;
  magSize: number;
  reloadTime: number;
  range: number;
  spread: number;
  pellets: number;
  color: number;
}

export interface VehicleSpec {
  kind: VehicleKind;
  nameAr: string;
  plate: string;
  bodyColor: number;
  accentColor: number;
  maxSpeed: number;
  accel: number;
  turnSpeed: number;
  maxHp: number;
  length: number;
  width: number;
}

export type PortraitId = 'mosaab' | 'ally' | 'mafia' | 'cover' | 'jomoui';

export interface StoryDialogue {
  speaker: string;
  role: string;
  portrait: PortraitId;
  text: string;
}

export interface RadioMessage {
  speaker: string;
  portrait: PortraitId;
  text: string;
}

export interface ChatChoice {
  id: string;
  label: string;
  replySpeaker: string;
  replyPortrait: PortraitId;
  replyText: string;
  rewardAction?: 'heal' | 'ammo' | 'cash' | 'hint';
}

export interface MissionDefinition {
  id: number;
  chapterLabel: string;
  title: string;
  objectiveText: string;
  district: DistrictId;
  targetPos: { x: number; z: number };
  type:
    | 'reach_cafe'
    | 'meet_ally'
    | 'ambush_convoy'
    | 'clear_checkpoint'
    | 'rescue_parents'
    | 'free_roam';
  dialogues: StoryDialogue[];
  rewardCash: number;
  unlocksWeapon?: WeaponId;
}

export interface MinimapEntity {
  x: number;
  z: number;
  kind: 'enemy' | 'ally' | 'car' | 'crate' | 'boss' | 'shop' | 'police';
}

export interface HudState {
  hp: number;
  maxHp: number;
  armor: number;
  cash: number;
  wantedLevel: number;
  districtName: string;
  inVehicle: boolean;
  vehicleName: string;
  vehiclePlate: string;
  vehicleHp: number;
  vehicleMaxHp: number;
  speedKmh: number;
  activeWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  ammoInMag: Record<WeaponId, number>;
  reserveAmmo: Record<WeaponId, number>;
  isReloading: boolean;
  missionIndex: number;
  missionTitle: string;
  missionObjective: string;
  missionProgressText: string;
  interactionPrompt: string | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  targetX: number | null;
  targetZ: number | null;
  minimapEntities: MinimapEntity[];
  isFreeRoam: boolean;
  kills: number;
  hitMarkerTimer: number;
  damageFlashTimer: number;
}
