export type CropKind = 'leaf' | 'bean';
export type Action = CropKind | 'water' | 'harvest';
export const CONFIG = {
  introDuration: 8,
  duration: 480, droughtAt: 70, droughtMultiplier: 2.25,
  startingWater: 100, startingMoney: 300, deliveryGoal: 4, droughtGoal: 2,
  wateringCost: 10, wateringAmount: 55, initialMoisture: 68, deathAfter: 22,
  canCapacity: 30, startingCanWater: 20,
  crops: {
    leaf: { name: '달빛 상추', duration: 30, drain: 1.05, cost: 15, price: 30 },
    bean: { name: '별빛 콩', duration: 45, drain: 0.48, cost: 25, price: 50 },
  },
} as const;
