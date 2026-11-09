import type { Action } from './GameConfig';

export type TutorialStep = 'plant' | 'water' | 'grow' | 'harvest' | 'deliver' | 'complete';
export const TUTORIAL_PLOT = 0;
export const TUTORIAL_GROWTH_SECONDS = 6;
export const TUTORIAL: Record<TutorialStep, { number: number; title: string; description: string; instruction: string; feedback: string; action: Action | null }> = {
  plant: { number: 1, title: '걸어서 밭으로 가볼까요?', description: 'WASD·방향키 또는 왼쪽 아래 조이스틱으로 빛나는 1번 밭 가까이 이동하세요. 밭의 테두리는 넘을 수 없어요.', instruction: '① 1번 밭 접근　② 1 / E 또는 오른쪽 큰 심기 버튼', feedback: 'YOU 표시가 있는 우주 캐릭터가 나예요.', action: 'leaf' },
  water: { number: 2, title: '가까이에서 물을 주세요.', description: '1번 밭 옆에서 물주기 버튼을 누르세요. 물뿌리개가 비면 왼쪽 H₂O 물탱크에 접근해 E / 물 채우기를 눌러요.', instruction: '2 / E 또는 오른쪽 물주기 버튼 · 물 −10', feedback: '씨앗 심기 성공! 총 물 100 중 20을 휴대하고 있어요.', action: 'water' },
  grow: { number: 3, title: '작물이 자라고 있어요!', description: '밭 옆에서 성장률·수분을 살펴보세요. 잠시 물탱크로 이동해 물뿌리개를 채워봐도 좋아요.', instruction: '연습 성장 약 6초 · 이동하고 돌아와도 괜찮아요', feedback: '물 공급 완료! 총 물과 휴대 물이 10씩 줄었어요.', action: null },
  harvest: { number: 4, title: '달빛 상추가 다 자랐어요!', description: '둥근 민트빛 잎과 초승달 표시를 확인하세요. 1번 밭에 접근하면 큰 행동 버튼이 수확으로 바뀌어요.', instruction: '1번 밭 가까이에서 3 / E 또는 수확 버튼', feedback: '달빛 상추 성장 100% · 수확 가능!', action: 'harvest' },
  deliver: { number: 5, title: '보급 기지로 걸어가세요!', description: '오른쪽 SUPPLY 보급 기지까지 통로를 따라 이동하세요. 수확물은 기지에 보관되고 직접 방문해야 납품할 수 있어요.', instruction: 'SUPPLY 접근 → E 또는 큰 납품하기 버튼', feedback: '수확 성공! 보급 기지에 달빛 상추 1개 보관 중.', action: null },
  complete: { number: 5, title: '농장 운영 준비 완료!', description: '이제 혼자서 농장을 운영할 수 있어요.', instruction: '곧 아그리아-7에 가뭄이 발생합니다. 남은 물을 효율적으로 관리하면서 작물 4개를 납품하세요.', feedback: '납품 완료! 자금 +30G · 연습 납품 1/4', action: null },
};
