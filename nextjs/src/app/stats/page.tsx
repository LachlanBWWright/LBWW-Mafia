import { Card, CardBody, CardTitle, CardText } from "react-bootstrap";

export default function Stats() {
  return (
    <Card style={{ flex: 1, margin: "2vh" }}>
      <CardBody>
        <CardTitle className="text-center">Statistics</CardTitle>
        <CardText>Stats go here! </CardText>
      </CardBody>
    </Card>
  );
}
