import React from "react";
import { Card } from "../ui/bootstrap-shim";

export function SettingsPage() {
  return (
    <Card style={{ margin: "2vh", flex: 1 }}>
      <Card.Body>
        <Card.Title className="text-center">Settings</Card.Title>
        <Card.Text>Settings page.</Card.Text>
      </Card.Body>
    </Card>
  );
}
