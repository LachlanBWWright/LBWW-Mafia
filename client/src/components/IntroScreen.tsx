import React from "react";
import { Card } from "../ui/bootstrap-shim";

export function IntroScreen() {
  return (
    <div style={{ padding: "2vh" }}>
      <Card style={{ margin: "auto" }}>
        <Card.Body>
          <Card.Title className="text-center">
            Welcome to LBWW Mafia!
          </Card.Title>
          <Card.Text>
            This is a mafia-style game created using a LBWW Stack, and making
            heavy use of Socket.io.
          </Card.Text>
          <Card.Text>Created by Lachlan Wright</Card.Text>
        </Card.Body>
      </Card>
    </div>
  );
}
