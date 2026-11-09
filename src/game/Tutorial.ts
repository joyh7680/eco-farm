import type { Action } from './GameConfig';

export type TutorialStep = 'plant' | 'water' | 'grow' | 'harvest' | 'deliver' | 'complete';
export const TUTORIAL_PLOT = 0;
export const TUTORIAL_GROWTH_SECONDS = 6;
export const TUTORIAL: Record<TutorialStep, { number: number; title: string; description: string; instruction: string; feedback: string; action: Action | null }> = {
  plant: { number: 1, title: '먼저 농작물을 심어볼까요?', description: '하단의 달빛 상추 버튼을 선택하고 빈 밭을 클릭하세요.', instruction: '① 달빛 상추 선택　② 빛나는 1번 밭 클릭·터치', feedback: '작은 씨앗에서 행성의 복구가 시작돼요.', action: 'leaf' },
  water: { number: 2, title: '작물이 자라려면 물이 필요해요.', description: '물주기 버튼을 선택하고 방금 심은 작물에 물을 공급하세요.', instruction: '① 물주기 선택　② 같은 1번 밭 클릭·터치', feedback: '잘했어요! 씨앗을 심었어요. 이제 물을 줘볼까요?', action: 'water' },
  grow: { number: 3, title: '작물이 자라고 있어요!', description: '성장률과 수분 게이지를 확인해 보세요.', instruction: '오른쪽 게이지를 관찰하세요 · 연습 성장 약 6초', feedback: '물 공급 완료! 물탱크에서 물 10을 사용했어요.', action: null },
  harvest: { number: 4, title: '작물이 다 자랐어요!', description: '하단 수확 버튼을 선택하고 다 자란 작물을 클릭하세요.', instruction: '① 수확 선택　② 반짝이는 1번 밭 클릭·터치', feedback: '성장률 100%! 이제 수확해 볼까요?', action: 'harvest' },
  deliver: { number: 5, title: '수확한 작물을 납품하세요!', description: '하단의 납품하기 버튼을 눌러주세요.', instruction: '① 보관함의 작물 확인　② 납품하기 클릭·터치', feedback: '수확 성공! 상단 보관함에 상추 1개가 들어갔어요.', action: null },
  complete: { number: 5, title: '농장 운영 준비 완료!', description: '이제 혼자서 농장을 운영할 수 있어요.', instruction: '곧 아그리아-7에 가뭄이 발생합니다. 남은 물을 효율적으로 관리하면서 작물 4개를 납품하세요.', feedback: '납품 완료! 자금 +30G · 연습 납품 1/4', action: null },
};
