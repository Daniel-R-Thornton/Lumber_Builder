import { v4 as uuidv4 } from 'uuid';
import { ScenePiece, Joint, Dimension } from './types';

export interface SampleProject {
  name: string;
  description: string;
  pieces: ScenePiece[];
  joints: Joint[];
  dimensions?: Dimension[];
}

export function createSampleBench(): SampleProject {
  const seatId = uuidv4();
  const legLId = uuidv4();
  const legRId = uuidv4();

  return {
    name: 'Garden Bench',
    description: 'Simple bench with 190mm-wide seat, two legs, and annotated dimensions.',
    pieces: [
      // Seat — 190×45 DAR pine, 1200mm long
      // Width (X)=190 gives a proper seating surface, Depth (Y)=45 is the thickness
      {
        id: seatId,
        lumberId: 'aus-hw190x45', // 190×45 hardwood-grade
        length: 1200,
        position: [0, 422.5, 0],
        rotation: [0, 0, 0],
      },
      // Left leg — 90×45, 400mm tall, rotated vertical (π/2 around X)
      // After rotation: 90mm wide (X), 400mm tall (Y), 45mm thick (Z)
      {
        id: legLId,
        lumberId: 'aus-90x45',
        length: 400,
        position: [-460, 200, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      // Right leg
      {
        id: legRId,
        lumberId: 'aus-90x45',
        length: 400,
        position: [460, 200, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
    ],
    joints: [
      // Left leg → seat (screws up into seat from leg top)
      {
        id: uuidv4(),
        piece1Id: legLId,
        piece2Id: seatId,
        position: [-460, 400, 0],
        normal: [0, 1, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 4,
        fixingSpacing: 60,
        fixingOffset: 0,
        fixingLength: 80,
        fixingEmbedPercent: 67,
      },
      // Right leg → seat
      {
        id: uuidv4(),
        piece1Id: legRId,
        piece2Id: seatId,
        position: [460, 400, 0],
        normal: [0, 1, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 4,
        fixingSpacing: 60,
        fixingOffset: 0,
        fixingLength: 80,
        fixingEmbedPercent: 67,
      },
    ],
    dimensions: [
      {
        id: uuidv4(),
        piece1Id: legLId,
        piece2Id: legRId,
        value: 920,
        labelOffset: [0, 100, 200],
      },
      {
        id: uuidv4(),
        piece1Id: legLId,
        piece2Id: seatId,
        value: 400,
        labelOffset: [-200, 50, 0],
      },
    ],
  };
}
