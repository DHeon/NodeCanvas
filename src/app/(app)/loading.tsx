// 대시보드·작업 공간을 서버에서 불러오는 동안 보이는 화면. 레이아웃이 튀지 않게 같은 바탕을 쓴다.
export default function Loading() {
  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center bg-paper text-sm text-lichen [color-scheme:light]"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-moss-deep motion-reduce:animate-none"
        />
        불러오는 중…
      </div>
    </div>
  );
}
