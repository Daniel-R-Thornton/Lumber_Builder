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
  length: number; // in mm
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
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

export interface Joint {
  id: string;
  piece1Id: string;
  piece2Id: string;
  position: [number, number, number];
  normal?: [number, number, number];
  fixingType: FixingType;
  fixingCount: number;
  fixingSpacing?: number;
  fixingOffset?: number;
  fixingAngle?: number;
  /** Length of each fastener in mm. Auto-calculated for bolts; user-selectable for screws/nails. */
  fixingLength?: number;
  /** How far into piece2 the fastener extends, as % of piece2 thickness. Default ~67 for screws, ~75 for nails. */
  fixingEmbedPercent?: number;
  /** Spacing mode: 'count' = N fasteners at spacing S; 'every' = one every X mm */
  fixingSpacingMode?: SpacingMode;
  /** Alignment for the first/last fastener position */
  fixingAlign?: FixingAlign;
}

