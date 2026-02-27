import React, { useState } from "react";
import { Navbar, Nav } from "../ui/bootstrap-shim";
import { Outlet, Link } from "react-router-dom";

export function MafSiteNavbar() {
  const [inGame, setInGame] = useState(false);
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
          <Navbar.Brand as={Link} to="/" /* disabled={inGame} */>
            LBWW Mafia
          </Navbar.Brand>
        </Nav>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" disabled={inGame}>
              Play
            </Nav.Link>
            <Nav.Link as={Link} to="/faq" disabled={inGame}>
              FAQ
            </Nav.Link>
            <Nav.Link as={Link} to="/roles" disabled={inGame}>
              Roles
            </Nav.Link>
            <Nav.Link as={Link} to="/stats" disabled={inGame}>
              Stats
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>

        <Nav>
          <Nav.Link as={Link} to="/settings" disabled={inGame}>
            Settings
          </Nav.Link>
          {/* <Nav.Link as={Link} to="/settings" className="justify-content-end" disabled={inGame}>Login Placeholder</Nav.Link> */}
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
        <Outlet context={setInGame} />
      </div>
    </div>
  );
}
