import "./globals.css";

export const metadata = {
  title: "Portfolio Tracker",
  description: "Your portfolio across brokers, in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
