import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Trader",
  description: "Personal swing trading decision engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav style={navStyle}>
          <div style={navContentStyle}>
            <Link href="/" style={logoStyle}>
              Swing Trader
            </Link>
            <div style={navLinksStyle}>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/candidates">Candidates</NavLink>
              <NavLink href="/settings">Settings</NavLink>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={navLinkStyle}>
      {children}
    </Link>
  );
}

const navStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  background: "#0a0a0a",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const navContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "0.75rem 2rem",
};

const logoStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: "bold",
  color: "var(--foreground)",
  textDecoration: "none",
};

const navLinksStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
};

const navLinkStyle: React.CSSProperties = {
  color: "var(--muted)",
  textDecoration: "none",
  fontSize: "0.875rem",
  transition: "color 0.1s",
};
