"use client";

import Link from "next/link";
import { Navbar, Nav } from "react-bootstrap";

export function MafSiteNavbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Navbar className="navbar-dark" bg="danger" expand="lg" sticky="top">
        <Nav>
          <Link href="/">
            <Navbar.Brand /* disabled={inGame} */>MERN Mafia</Navbar.Brand>
          </Link>
        </Nav>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto flex flex-row gap-2">
            <Link className="text-white" href="/">
              Play
            </Link>
            <Link className="text-white" href="/lobby">
              Lobby
            </Link>
            <Link className="text-white" href="/faq">
              FAQ
            </Link>
            <Link className="text-white" href="/roles">
              Roles
            </Link>
            <Link className="text-white" href="/stats">
              Stats
            </Link>
          </Nav>
        </Navbar.Collapse>

        <Nav>
          <Link className="text-white" href="/settings">
            Settings
          </Link>
        </Nav>
      </Navbar>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
