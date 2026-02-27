import React from "react";
import { Card } from "../ui/bootstrap-shim";
import { roles } from "../info/roles";

export function RolesPage() {
  return (
    <Card style={{ margin: "2vh", flex: 1, overflow: "auto" }}>
      <Card.Body>
        <Card.Title className="text-center">Roles</Card.Title>
        {[...roles.entries()].map((item) => (
          <>
            <Card.Text style={{ fontWeight: "bold" }}>{item[0]}</Card.Text>
            <Card.Text>{item[1]}</Card.Text>
          </>
        ))}
      </Card.Body>
    </Card>
  );
}
