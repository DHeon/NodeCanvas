# 링크 노드

## 사용

- 왼쪽 도구 막대의 링크 버튼이나 `L` 키로 빈 링크 노드(480×318, 16:9 영상 + 제목 바)를 만들고, 노드 안 입력칸에 주소를 넣는다. 캔버스에서 `https://`로 시작하는 주소를 붙여넣어도 링크 노드가 생긴다.
- **유튜브** 주소(watch, youtu.be, shorts, embed, `t=` 시작 시각)는 노드 본문에 플레이어만 꽉 채워 보여준다. 개인정보 보호 모드인 `youtube-nocookie.com` 플레이어를 쓴다.
- **웹페이지**는 서버가 미리 확인해 다른 사이트 안에 띄워도 되는 페이지면 노드 안 iframe으로 보여준다. 막아둔 사이트(`X-Frame-Options`, CSP `frame-ancestors`)나 http 페이지는 미리보기 카드(대표 이미지·사이트 이름·제목·설명·새 탭에서 열기)로 보여준다.
- 노드 제목이 비어 있으면 페이지 제목(유튜브는 영상 제목)으로 채운다.
- 속성 패널 "링크"에서 주소를 바꾸고, 새 탭에서 열거나 미리보기를 다시 불러온다.

## 구조

- `types.ts`: `LinkNode = { url, preview? }`. 빈 `url`은 아직 주소를 넣지 않은 상태.
- `link-embed.ts`: 주소 다듬기(`normalizeLinkUrl`), 유튜브 판별(`parseYouTube`), 플레이어 주소. 화면·서버·스키마가 함께 쓴다.
- `link-preview-parse.ts`: 공용 IP 판별, iframe 가능 여부 판단, HTML의 Open Graph 읽기. 네트워크를 쓰지 않아 테스트한다.
- `link-preview-server.ts`: 실제 요청. 유튜브는 공식 oEmbed를 쓴다.
- `src/app/api/link-preview/route.ts`: 로그인·Origin 확인 후 미리보기 반환.
- `use-link-previews.ts`: 노드별 요청·취소·로딩 상태. 결과는 요청 당시의 공간 경로·주소가 같은 노드에만 적용한다.
- `link-node-view.tsx`: 주소 입력 / 유튜브 / iframe / 카드.

## 보안

서버가 사용자를 대신해 임의 주소를 열기 때문에(SSRF) 다음을 지킨다.

- http·https, 기본 포트(80·443)만. 계정 정보가 든 주소는 거절.
- DNS로 찾은 모든 주소가 공용 IP여야 한다. 사설망·루프백·링크 로컬(169.254.x, 클라우드 메타데이터)·멀티캐스트·IPv4를 담은 IPv6도 막는다.
- 리다이렉트는 최대 3번, 단계마다 다시 검사. 6초 시간 제한, HTML은 512KB까지만 읽는다.
- 노드 안 iframe은 `sandbox`(스크립트·폼·팝업만 허용)와 `referrerPolicy="no-referrer"`로 띄운다.
- 한계: DNS 확인과 실제 연결 사이에 주소가 바뀌는 공격(DNS rebinding)까지는 막지 않는다. 운영 배포 전에는 연결 단계에서 IP를 고정하는 방식이 필요하다.

## 저장

- `url`과 `preview`(가능 여부·제목·설명·이미지 주소·사이트 이름)를 문서에 저장해 다시 열 때 서버 요청 없이 바로 그린다. 스키마가 http(s) 주소와 길이를 검사한다.

## 검증

```powershell
node --import tsx --test scripts/test-link-node.ts
```
