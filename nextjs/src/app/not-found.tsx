import { Card, CardBody, CardTitle, CardText } from "react-bootstrap";

export default function FourOFour() {
  return (
    <Card style={{ margin: "2vh", flex: 1 }}>
      <CardBody>
        <CardTitle className="text-center">404</CardTitle>
        <CardText>This is the 404 screen. Cool!</CardText>
      </CardBody>
    </Card>
  );
}
