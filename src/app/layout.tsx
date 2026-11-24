import type { Metadata } from 'next';
import './globals.css';

// ▼ 여기서 브라우저 탭 제목과 이모지 아이콘을 원하시는 대로 수정하세요!
const TAB_TITLE = '사내 교육 퀴즈';
const TAB_EMOJI = '🎓';

export const metadata: Metadata = {
  title: TAB_TITLE,
  description: '직원 역량 강화를 위한 맞춤형 교육 퀴즈',
  icons: {
    icon: `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${TAB_EMOJI}</text></svg>`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}