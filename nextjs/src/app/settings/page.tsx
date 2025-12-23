import { Card, CardBody, CardTitle, CardText } from "react-bootstrap";

export default function SettingsPage() {
  return (
    <Card style={{ margin: "2vh", flex: 1 }}>
      <CardBody>
        <CardTitle className="text-center">Settings</CardTitle>
        <CardText>Settings page.</CardText>
      </CardBody>
    </Card>
  );
}
