"use client";

import Link from "next/link";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

export function MafSiteNavbar({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

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
            <Navbar.Brand>MERN Mafia</Navbar.Brand>
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
            <Link className="text-white" href="/leaderboard">
              Leaderboard
            </Link>
          </Nav>
        </Navbar.Collapse>

        <Nav>
          {status === 'loading' ? (
            <span className="text-white">...</span>
          ) : session ? (
            <NavDropdown
              title={
                <span className="d-inline-flex align-items-center">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user?.name ?? 'User'}
                      width={32}
                      height={32}
                      className="rounded-circle me-2"
                    />
                  )}
                  <span className="text-white">{session.user?.name ?? 'Account'}</span>
                </span>
              }
              id="account-nav-dropdown"
              align="end"
            >
              <NavDropdown.Item as="div">
                <Link href="/account" className="text-decoration-none text-dark">
                  My Account
                </Link>
              </NavDropdown.Item>
              <NavDropdown.Item as="div">
                <Link href="/history" className="text-decoration-none text-dark">
                  Match History
                </Link>
              </NavDropdown.Item>
              <NavDropdown.Item as="div">
                <Link href="/account/profile" className="text-decoration-none text-dark">
                  Edit Profile
                </Link>
              </NavDropdown.Item>
              <NavDropdown.Item as="div">
                <Link href="/account/settings" className="text-decoration-none text-dark">
                  Settings
                </Link>
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => signOut({ callbackUrl: '/' })}>
                Sign Out
              </NavDropdown.Item>
            </NavDropdown>
          ) : (
            <>
              <Link 
                href="/auth/signin"
                className="btn btn-outline-light btn-sm me-2"
              >
                Sign In
              </Link>
              <Link className="text-white" href="/settings">
                Settings
              </Link>
            </>
          )}
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
