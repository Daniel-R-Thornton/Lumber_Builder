import { v4 as uuidv4 } from 'uuid';
import { ScenePiece, Joint } from './types';

export interface SampleProject {
  name: string;
  description: string;
  pieces: ScenePiece[];
  joints: Joint[];
}

export function createSampleBench(): SampleProject {
  const seatId = uuidv4();
  const legLId = uuidv4();
  const legRId = uuidv4();
  const railId = uuidv4();

  return {
    name: 'Garden Bench',
    description: 'Simple 3-leg bench with cross rail. 90×45 pine framing.',
    pieces: [
      {
        id: seatId,
        lumberId: 'aus-90x45',
        length: 1200,
        position: [0, 485, 0],
        rotation: [0, 0, 0],
      },
      {
        id: legLId,
        lumberId: 'aus-90x45',
        length: 450,
        position: [-420, 225, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      {
        id: legRId,
        lumberId: 'aus-90x45',
        length: 450,
        position: [420, 225, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      {
        id: railId,
        lumberId: 'aus-90x35',
        length: 800,
        position: [0, 250, -80],
        rotation: [Math.PI / 2, 0, 0],
      },
    ],
    joints: [
      {
        id: uuidv4(),
        piece1Id: legLId,
        piece2Id: seatId,
        position: [-420, 450, 0],
        normal: [0, 1, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 4,
        fixingSpacing: 50,
        fixingOffset: 0,
        fixingLength: 80,
        fixingEmbedPercent: 67,
      },
      {
        id: uuidv4(),
        piece1Id: legRId,
        piece2Id: seatId,
        position: [420, 450, 0],
        normal: [0, 1, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 4,
        fixingSpacing: 50,
        fixingOffset: 0,
        fixingLength: 80,
        fixingEmbedPercent: 67,
      },
      {
        id: uuidv4(),
        piece1Id: legLId,
        piece2Id: railId,
        position: [-420, 250, -80],
        normal: [1, 0, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 2,
        fixingSpacing: 30,
        fixingOffset: 0,
        fixingLength: 70,
        fixingEmbedPercent: 67,
      },
      {
        id: uuidv4(),
        piece1Id: legRId,
        piece2Id: railId,
        position: [420, 250, -80],
        normal: [-1, 0, 0],
        fixingType: 'Screws (Wood)',
        fixingCount: 2,
        fixingSpacing: 30,
        fixingOffset: 0,
        fixingLength: 70,
        fixingEmbedPercent: 67,
      },
    ],
  };
}
