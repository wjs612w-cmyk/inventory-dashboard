// ───────── 데이터 소스 ─────────
// 구글 시트 "웹에 게시"한 CSV 링크. 탭이 여러 개라면 같은 형식의 탭을 배열에 추가하면 합쳐서 보여줍니다.
export const CSV_SOURCES = [
  {
    name: '판매 데이터 집계',
    url:
      import.meta.env.VITE_CSV_URL ||
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8PE4oemx-y8QuLz_zbt-GO7jwYgWw00z_312B8JJ1vgiGmXtNrXZgc4Avg5mY3ZrRTXAwLFtcUaPl/pub?gid=576617677&single=true&output=csv',
  },
]

export const CATEGORIES = ['마스크', '캡슐세제', '액상세제', '섬유유연제', '생활용품']

// 시트 헤더명(공백 무시) → 내부 키. 시트 헤더가 바뀌면 여기만 고치면 됩니다.
export const COLUMNS = {
  category: '품목군', // A열
  brand: '브랜드', // B열
  group: '카테고리',
  sku: '완제품 품번',
  name: '품목',
  salesPlan: '당월 영업계획',
  sheetProgress: '계획 진도율',
  nextSalesPlan: '다음달 영업계획',
  prevShipped: '전월 출고량',
  shipped: '당월 출고량',
  sheetForecast: '당월 예상 판매량',
  w1: '최근 7일',
  w2: '8일 전 ~ 14일 전',
  w3: '15일 전 ~ 21일 전',
  w4: '22일 전 ~ 28일 전',
  prodPlan: '당월 생산계획',
  nextProdPlan: '다음달 생산계획',
  inbound: '당월 입고 수량',
  stock: '현재고',
}

// 그래프 x축 순서 (과거 → 최근)
export const WEEK_LABELS = ['22~28일 전', '15~21일 전', '8~14일 전', '최근 7일']

// 판매 급증 판단 시 너무 작은 수량(5개 → 10개 같은 경우)을 무시하기 위한 기준.
// 최근 7일 판매량이 이 값 미만이면 급증으로 보지 않습니다. 필요에 맞게 바꾸세요.
export const SPIKE_MIN_QTY = 100

// 판매 급감 판단 시, 직전 3주 주간 평균이 이 값 미만인 품목(원래 거의 안 팔리던 품목)은 무시합니다.
export const DROP_MIN_QTY = 100
