export type Region = 'US' | 'AUS';

export interface StandardLumber {
  id: string;
  region: Region;
  name: string;
  actualWidth: number; // in mm
  actualDepth: number; // in mm
  pricePerMeter: number; // in USD
}

export type FixingType = 'None' | 'Screws (Wood)' | 'Screws (Pocket)' | 'Nails' | 'Bolts' | 'Brackets';

export interface ScenePiece {
  id: string;
  lumberId: string;
  length: number;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  jointIds: string[]; // FK → Joint
}

export interface Dimension {
  id: string;
  piece1Id: string;
  piece2Id: string;
  /** User-set dimension value in mm. Auto-initialised to actual distance on creation. */
  value: number;
  /** Where the label floats in 3D space */
  labelOffset: [number, number, number];
}

export type SpacingMode = 'count' | 'every';
export type FixingAlign = 'left' | 'right' | 'center';

export type JointType = 'butt' | 'tee' | 'corner';

export interface FastenerConfig {
  count: number;
  spacing: number;
  embedPercent: number;
  manualOverrides?: [number, number, number][];
}

export interface Joint {
  id: string;
  piece1Id: string;
  piece2Id: string;
  type: JointType;
  position: [number, number, number];
  normal?: [number, number, number];
  fixingType: FixingType;
  fixingCount: number;
  fixingSpacing?: number;
  fixingOffset?: number;
  fixingAngle?: number;
  fixingLength?: number;
  fixingEmbedPercent?: number;
  fixingSpacingMode?: SpacingMode;
  fixingAlign?: FixingAlign;
  dirty: boolean;
}

export interface Fastener {
  id: string;
  jointId: string;
  worldPos: [number, number, number];
  worldNormal: [number, number, number];
  length: number;
  headOffset: number;
}

