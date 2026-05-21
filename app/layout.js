import './globals.css';

export const metadata = {
  title: 'Nexora Alimentos',
  description: 'Cardapio digital multiempresa'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
