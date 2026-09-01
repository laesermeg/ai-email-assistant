import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI 이메일 비서",
  description: "교수·연구자를 위한 AI 이메일 비서",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* SessionProvider: 로그인 상태를 앱 전체(특히 클라이언트 컴포넌트)에서 읽을 수 있게 해줌 */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
