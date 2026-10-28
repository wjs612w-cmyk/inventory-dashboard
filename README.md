# 재고·판매 대시보드 (Vite + React + PapaParse + Recharts + Tailwind v4)

```bash
npm install
npm run dev
```

- 데이터: 구글 시트 "웹에 게시" CSV (`src/config.js`의 `CSV_SOURCES`, 또는 `.env`의 `VITE_CSV_URL`)
- 시트 1행에 있는 숫자(예: K1=27)를 "경과일수"로 읽어 월말 예상 재고·진도율 계산에 사용합니다.
- 시트 헤더명이 바뀌면 `src/config.js`의 `COLUMNS`만 수정하세요.
- 웹 게시 CSV는 구글 쪽에서 수 분 간격으로 갱신됩니다. 수정 직후 바로 반영되지 않을 수 있습니다.
