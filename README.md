# Singapore Home Map

싱가포르 6개 지역, 임대 매물 18개를 비교하는 한국어 지도입니다.

**웹사이트:** https://jaemoon-sim.github.io/singapore-e-min/

## 사용하기

- 지도 핀에 마우스를 올리면 단지 이름, 주소, 월세, 방 수와 예상 통근 시간이 표시됩니다.
- 핀 또는 목록의 매물을 누르면 조사한 전체 정보와 PropertyGuru 원문 링크가 열립니다.
- 가까운 핀은 묶여 있습니다. 묶음 핀을 누르면 확대되고, 개별 건물의 핀이 나타납니다.
- Google Singapore 사무실은 `G` 핀으로 표시합니다. 경로 버튼은 Google Maps의 대중교통 검색을 엽니다.
- 지역, S$6,000 이하, 방 수, 단지·주소·MRT 검색과 정렬을 지원합니다.
- 작은 화면에서는 하단의 지도/목록 탭으로 전환합니다.

## 데이터 기준과 한계

2026-11-02 PropertyGuru 조사 스냅샷입니다. 자동 갱신하지 않습니다. 원본은 `research/2026-11-02-rentals.json`과 `.md`에 있습니다.

- 월세 검색 상한 S$6,500, 기준예산 S$6,000, 침실 2개 이상, MRT 도보 10분 미만.
- 지역은 영상의 묶음 기준이며 행정 경계를 뜻하지 않습니다.
- 통근 시간은 PropertyGuru 앱 Public Transport 예상값입니다. 아침 도착 시각을 지정하지 않았으며, 출근 시간대 실제 경로를 검증한 값이 아닙니다.
- MRT 도보 시간은 매물 표기입니다. 실제 동·출입구에 따라 달라집니다.
- TOP 날짜의 원래 정밀도를 유지합니다. 입주일 상충과 추가 비용 등 조사 메모도 상세 화면에 표시합니다.
- 좌표는 SLA OneMap의 주소 검색 결과와 동·도로명을 일치 확인한 건물 위치입니다. 호실이나 출입구의 위치가 아닙니다. `research/geocoding.json`에 검색 결과와 출처를 보관합니다.
- 매물 유효 여부, 월세, 입주 가능일, 추가 비용은 원문과 에이전트에게 다시 확인해야 합니다.

## 로컬 실행

빌드나 서버 API 없이 `docs/`를 제공하는 정적 사이트입니다.

```sh
python3 -m http.server 8080 --directory docs
```

http://localhost:8080/ 에서 확인합니다. `file://`로 열면 데이터 요청이 제한되므로 HTTP 서버를 사용하세요.

## 데이터 수정

1. `research/2026-11-02-rentals.json`을 수정합니다.
2. 주소가 바뀌면 `python3 research/geocode.py`로 OneMap 결과를 받습니다. 여러 결과나 주소 불일치가 있으면 직접 검토합니다.
3. `python3 research/prepare-site.py`로 `docs/data/listings.json`을 생성합니다.
4. `docs/`를 배포합니다. 데이터 파일을 직접 수정할 수도 있습니다.

## GitHub Pages 및 다른 호스팅

GitHub Pages 소스는 `main` 브랜치의 `/docs`입니다. 해당 브랜치에 push하면 배포됩니다. `docs/.nojekyll`로 정적 파일을 그대로 제공합니다.

다른 정적 호스팅이나 Nginx에서는 `docs/` 내용을 웹 루트에 복사하면 됩니다. 모든 앱 자산과 데이터 경로가 상대 경로여서 하위 디렉터리에서도 작동합니다. 백엔드, API 키, 외부 JavaScript CDN은 필요하지 않습니다. 배경 지도는 인터넷 연결이 필요합니다.

## 지도 및 라이선스

- 주소 좌표: [SLA OneMap](https://www.onemap.gov.sg/)
- 배경 지도 데이터·타일: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). 대규모 트래픽으로 운영할 때는 [타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/)에 맞는 제공업체로 교체하세요. 일괄 다운로드나 오프라인 캐싱을 구현하지 않습니다.
- 지도 라이브러리: [Leaflet 1.9.4](https://leafletjs.com/), BSD-2-Clause, `docs/assets/vendor/leaflet/LICENSE`에 원문 포함.
- 매물 정보·원문 링크: PropertyGuru. 이미지나 원문 상세 설명을 복제하지 않습니다.

지도 제작에 사용한 자료는 데이터 파일에 보존되어 있으며, 사이트는 사용자 위치·로그인·추적 분석을 사용하지 않습니다.
