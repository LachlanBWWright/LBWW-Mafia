import React from "react";
import { Card } from "../ui/bootstrap-shim";

export function Stats() {
  return (
    <Card style={{ flex: 1, margin: "2vh" }}>
      <Card.Body>
        <Card.Title className="text-center">Statistics</Card.Title>
        <Card.Text>Stats go here! </Card.Text>
      </Card.Body>
    </Card>
  );
}
