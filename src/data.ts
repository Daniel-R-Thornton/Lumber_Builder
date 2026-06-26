import { StandardLumber } from './types';

export const LUMBER_LIBRARY: StandardLumber[] = [
  // ═══════════════════════════════════════════════════════════════
  // US Standard Lumber (Softwood, dimensional)
  // Nominal vs actual: standard dimensional lumber references
  // ═══════════════════════════════════════════════════════════════
  { id: 'us-2x2', region: 'US', name: '2×2', actualWidth: 38.1, actualDepth: 38.1, pricePerMeter: 1.50 },
  { id: 'us-2x4', region: 'US', name: '2×4', actualWidth: 88.9, actualDepth: 38.1, pricePerMeter: 2.20 },
  { id: 'us-2x6', region: 'US', name: '2×6', actualWidth: 139.7, actualDepth: 38.1, pricePerMeter: 3.50 },
  { id: 'us-2x8', region: 'US', name: '2×8', actualWidth: 184.2, actualDepth: 38.1, pricePerMeter: 4.80 },
  { id: 'us-2x10', region: 'US', name: '2×10', actualWidth: 235.0, actualDepth: 38.1, pricePerMeter: 6.50 },
  { id: 'us-4x4', region: 'US', name: '4×4', actualWidth: 88.9, actualDepth: 88.9, pricePerMeter: 5.50 },

  // ═══════════════════════════════════════════════════════════════
  // AUS Radiata Pine — Kiln Dried Dressed All Round (KD DAR)
  // Most common framing timber. MGP10/MGP12 rated.
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-70x35', region: 'AUS', name: '70×35', actualWidth: 70, actualDepth: 35, pricePerMeter: 2.10 },
  { id: 'aus-70x45', region: 'AUS', name: '70×45', actualWidth: 70, actualDepth: 45, pricePerMeter: 2.80 },
  { id: 'aus-90x35', region: 'AUS', name: '90×35', actualWidth: 90, actualDepth: 35, pricePerMeter: 2.80 },
  { id: 'aus-90x45', region: 'AUS', name: '90×45', actualWidth: 90, actualDepth: 45, pricePerMeter: 3.60 },
  { id: 'aus-120x35', region: 'AUS', name: '120×35', actualWidth: 120, actualDepth: 35, pricePerMeter: 3.80 },
  { id: 'aus-120x45', region: 'AUS', name: '120×45', actualWidth: 120, actualDepth: 45, pricePerMeter: 4.80 },
  { id: 'aus-140x35', region: 'AUS', name: '140×35', actualWidth: 140, actualDepth: 35, pricePerMeter: 4.50 },
  { id: 'aus-140x45', region: 'AUS', name: '140×45', actualWidth: 140, actualDepth: 45, pricePerMeter: 5.90 },
  { id: 'aus-170x35', region: 'AUS', name: '170×35', actualWidth: 170, actualDepth: 35, pricePerMeter: 5.50 },
  { id: 'aus-190x45', region: 'AUS', name: '190×45', actualWidth: 190, actualDepth: 45, pricePerMeter: 8.50 },
  { id: 'aus-240x45', region: 'AUS', name: '240×45', actualWidth: 240, actualDepth: 45, pricePerMeter: 12.00 },
  { id: 'aus-290x45', region: 'AUS', name: '290×45', actualWidth: 290, actualDepth: 45, pricePerMeter: 15.00 },

  // ═══════════════════════════════════════════════════════════════
  // AUS Radiata Pine KD DAR — Small section (battens, furring)
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-12x12', region: 'AUS', name: '12×12', actualWidth: 12, actualDepth: 12, pricePerMeter: 0.80 },
  { id: 'aus-12x19', region: 'AUS', name: '12×19', actualWidth: 12, actualDepth: 19, pricePerMeter: 0.90 },
  { id: 'aus-19x19', region: 'AUS', name: '19×19', actualWidth: 19, actualDepth: 19, pricePerMeter: 1.00 },
  { id: 'aus-19x35', region: 'AUS', name: '19×35', actualWidth: 19, actualDepth: 35, pricePerMeter: 1.20 },
  { id: 'aus-19x42', region: 'AUS', name: '19×42', actualWidth: 19, actualDepth: 42, pricePerMeter: 1.30 },
  { id: 'aus-35x35', region: 'AUS', name: '35×35', actualWidth: 35, actualDepth: 35, pricePerMeter: 1.50 },
  { id: 'aus-42x19', region: 'AUS', name: '42×19', actualWidth: 42, actualDepth: 19, pricePerMeter: 1.30 },
  { id: 'aus-42x35', region: 'AUS', name: '42×35', actualWidth: 42, actualDepth: 35, pricePerMeter: 1.60 },
  { id: 'aus-45x35', region: 'AUS', name: '45×35', actualWidth: 45, actualDepth: 35, pricePerMeter: 1.70 },
  { id: 'aus-45x90', region: 'AUS', name: '45×90', actualWidth: 45, actualDepth: 90, pricePerMeter: 3.60 },

  // ═══════════════════════════════════════════════════════════════
  // AUS Dressed Finish Timber (planed, suited for exposed work)
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-d42x18', region: 'AUS', name: 'D 42×18', actualWidth: 42, actualDepth: 18, pricePerMeter: 1.40 },
  { id: 'aus-d66x18', region: 'AUS', name: 'D 66×18', actualWidth: 66, actualDepth: 18, pricePerMeter: 1.80 },
  { id: 'aus-d66x30', region: 'AUS', name: 'D 66×30', actualWidth: 66, actualDepth: 30, pricePerMeter: 2.20 },
  { id: 'aus-d66x42', region: 'AUS', name: 'D 66×42', actualWidth: 66, actualDepth: 42, pricePerMeter: 2.80 },
  { id: 'aus-d90x18', region: 'AUS', name: 'D 90×18', actualWidth: 90, actualDepth: 18, pricePerMeter: 2.00 },
  { id: 'aus-d90x30', region: 'AUS', name: 'D 90×30', actualWidth: 90, actualDepth: 30, pricePerMeter: 2.80 },
  { id: 'aus-d90x42', region: 'AUS', name: 'D 90×42', actualWidth: 90, actualDepth: 42, pricePerMeter: 3.50 },
  { id: 'aus-d90x66', region: 'AUS', name: 'D 90×66', actualWidth: 90, actualDepth: 66, pricePerMeter: 4.50 },
  { id: 'aus-d116x18', region: 'AUS', name: 'D 116×18', actualWidth: 116, actualDepth: 18, pricePerMeter: 2.50 },
  { id: 'aus-d116x30', region: 'AUS', name: 'D 116×30', actualWidth: 116, actualDepth: 30, pricePerMeter: 3.50 },
  { id: 'aus-d116x42', region: 'AUS', name: 'D 116×42', actualWidth: 116, actualDepth: 42, pricePerMeter: 4.20 },
  { id: 'aus-d138x18', region: 'AUS', name: 'D 138×18', actualWidth: 138, actualDepth: 18, pricePerMeter: 3.00 },
  { id: 'aus-d138x30', region: 'AUS', name: 'D 138×30', actualWidth: 138, actualDepth: 30, pricePerMeter: 4.00 },
  { id: 'aus-d138x42', region: 'AUS', name: 'D 138×42', actualWidth: 138, actualDepth: 42, pricePerMeter: 5.00 },

  // ═══════════════════════════════════════════════════════════════
  // AUS Kiln Dried Hardwood & Pine (structural, F-rated)
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-hw70x35', region: 'AUS', name: 'HD 70×35', actualWidth: 70, actualDepth: 35, pricePerMeter: 3.50 },
  { id: 'aus-hw70x45', region: 'AUS', name: 'HD 70×45', actualWidth: 70, actualDepth: 45, pricePerMeter: 4.50 },
  { id: 'aus-hw90x35', region: 'AUS', name: 'HD 90×35', actualWidth: 90, actualDepth: 35, pricePerMeter: 4.50 },
  { id: 'aus-hw90x45', region: 'AUS', name: 'HD 90×45', actualWidth: 90, actualDepth: 45, pricePerMeter: 5.80 },
  { id: 'aus-hw120x35', region: 'AUS', name: 'HD 120×35', actualWidth: 120, actualDepth: 35, pricePerMeter: 6.00 },
  { id: 'aus-hw120x45', region: 'AUS', name: 'HD 120×45', actualWidth: 120, actualDepth: 45, pricePerMeter: 7.50 },
  { id: 'aus-hw140x35', region: 'AUS', name: 'HD 140×35', actualWidth: 140, actualDepth: 35, pricePerMeter: 7.00 },
  { id: 'aus-hw140x45', region: 'AUS', name: 'HD 140×45', actualWidth: 140, actualDepth: 45, pricePerMeter: 9.00 },
  { id: 'aus-hw190x45', region: 'AUS', name: 'HD 190×45', actualWidth: 190, actualDepth: 45, pricePerMeter: 12.00 },
  { id: 'aus-hw240x45', region: 'AUS', name: 'HD 240×45', actualWidth: 240, actualDepth: 45, pricePerMeter: 16.00 },

  // ═══════════════════════════════════════════════════════════════
  // AUS Treated H3 Finger Jointed Pine (F7, GL8, GL10)
  // Outdoor / weather-exposed use
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-t66x30', region: 'AUS', name: 'T 66×30', actualWidth: 66, actualDepth: 30, pricePerMeter: 2.50 },
  { id: 'aus-t66x42', region: 'AUS', name: 'T 66×42', actualWidth: 66, actualDepth: 42, pricePerMeter: 3.20 },
  { id: 'aus-t90x30', region: 'AUS', name: 'T 90×30', actualWidth: 90, actualDepth: 30, pricePerMeter: 3.20 },
  { id: 'aus-t90x42', region: 'AUS', name: 'T 90×42', actualWidth: 90, actualDepth: 42, pricePerMeter: 4.00 },
  { id: 'aus-t138x30', region: 'AUS', name: 'T 138×30', actualWidth: 138, actualDepth: 30, pricePerMeter: 4.80 },
  { id: 'aus-t138x42', region: 'AUS', name: 'T 138×42', actualWidth: 138, actualDepth: 42, pricePerMeter: 6.00 },
  { id: 'aus-t185x42', region: 'AUS', name: 'T 185×42', actualWidth: 185, actualDepth: 42, pricePerMeter: 8.00 },
  { id: 'aus-t230x42', region: 'AUS', name: 'T 230×42', actualWidth: 230, actualDepth: 42, pricePerMeter: 10.00 },
  { id: 'aus-t280x42', region: 'AUS', name: 'T 280×42', actualWidth: 280, actualDepth: 42, pricePerMeter: 13.00 },

  // ═══════════════════════════════════════════════════════════════
  // AUS F8 Treated Primed Pine Posts
  // ═══════════════════════════════════════════════════════════════
  { id: 'aus-p88x88', region: 'AUS', name: 'Post 88×88', actualWidth: 88, actualDepth: 88, pricePerMeter: 8.00 },
  { id: 'aus-p112x112', region: 'AUS', name: 'Post 112×112', actualWidth: 112, actualDepth: 112, pricePerMeter: 12.00 },
  { id: 'aus-p135x135', region: 'AUS', name: 'Post 135×135', actualWidth: 135, actualDepth: 135, pricePerMeter: 16.00 },
  { id: 'aus-p185x185', region: 'AUS', name: 'Post 185×185', actualWidth: 185, actualDepth: 185, pricePerMeter: 24.00 },
];

export const getLumberById = (id: string) => LUMBER_LIBRARY.find(l => l.id === id);
