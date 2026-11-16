/** 화면에 맞춰 보는 배율이 이 값 이상이면 이미 원본 크기로 보는 것으로 친다(반올림 오차). */
const ACTUAL_SIZE_EPSILON = 0.001;

/**
 * 크게 보기의 "원본 크기 / 화면에 맞추기" 버튼 상태.
 * @param fitScale 화면에 맞춰 볼 때의 배율(그려진 폭 ÷ 원본 폭). 아직 재지 못했으면 null.
 * @param actualSize 지금 원본 크기로 보는 중인지.
 */
export function actualSizeButton(
  fitScale: number | null,
  actualSize: boolean,
): { label: string; disabled: boolean; title: string } {
  if (actualSize)
    return {
      label: "화면에 맞추기",
      disabled: false,
      title: "화면에 맞춰 보기",
    };
  if (fitScale === null)
    return { label: "원본 크기", disabled: false, title: "1:1 픽셀로 보기" };
  // 화면보다 작은 이미지는 줄이지 않으므로 이미 원본 크기다.
  if (fitScale >= 1 - ACTUAL_SIZE_EPSILON)
    return {
      label: "원본 크기",
      disabled: true,
      title: "이미 원본 크기로 보고 있어요",
    };
  return {
    label: `원본 크기 · 지금 ${Math.round(fitScale * 100)}%`,
    disabled: false,
    title: "1:1 픽셀로 보기",
  };
}
