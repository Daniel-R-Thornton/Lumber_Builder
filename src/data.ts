import { StandardLumber } from './types';

export const LUMBER_LIBRARY: StandardLumber[] = [
  // US Standard Lumber (Softwood, dimensional)
  // Nominal vs Actual: (standard dimensional lumber references)
  { id: 'us-2x2', region: 'US', name: '2x2', actualWidth: 38.1, actualDepth: 38.1, pricePerMeter: 1.50 },
  { id: 'us-2x4', region: 'US', name: '2x4', actualWidth: 88.9, actualDepth: 38.1, pricePerMeter: 2.20 },
  { id: 'us-2x6', region: 'US', name: '2x6', actualWidth: 139.7, actualDepth: 38.1, pricePerMeter: 3.50 },
  { id: 'us-2x8', region: 'US', name: '2x8', actualWidth: 184.2, actualDepth: 38.1, pricePerMeter: 4.80 },
  { id: 'us-2x10', region: 'US', name: '2x10', actualWidth: 235.0, actualDepth: 38.1, pricePerMeter: 6.50 },
  { id: 'us-4x4', region: 'US', name: '4x4', actualWidth: 88.9, actualDepth: 88.9, pricePerMeter: 5.50 },
  
  // AUS Standard Lumber (Metric pine framing MGP10/MGP12)
  { id: 'aus-70x35', region: 'AUS', name: '70x35', actualWidth: 70, actualDepth: 35, pricePerMeter: 2.10 },
  { id: 'aus-90x35', region: 'AUS', name: '90x35', actualWidth: 90, actualDepth: 35, pricePerMeter: 2.80 },
  { id: 'aus-90x45', region: 'AUS', name: '90x45', actualWidth: 90, actualDepth: 45, pricePerMeter: 3.60 },
  { id: 'aus-140x45', region: 'AUS', name: '140x45', actualWidth: 140, actualDepth: 45, pricePerMeter: 5.90 },
  { id: 'aus-190x45', region: 'AUS', name: '190x45', actualWidth: 190, actualDepth: 45, pricePerMeter: 8.50 },
  { id: 'aus-240x45', region: 'AUS', name: '240x45', actualWidth: 240, actualDepth: 45, pricePerMeter: 12.00 },
];

export const getLumberById = (id: string) => LUMBER_LIBRARY.find(l => l.id === id);
