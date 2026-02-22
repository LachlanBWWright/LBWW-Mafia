import React, { useEffect, useState } from "react";
import { Card, Tooltip, OverlayTrigger, Button } from "../ui/bootstrap-shim";
import { useOutletContext } from "react-router-dom";
import { Room } from "./Room";
import { roles } from "../info/roles";
import ReCAPTCHA from "react-google-recaptcha";

export function PlayPage({ debug }: { debug: boolean }) {
  const [playerName, setPlayerName] = useState("");
  const [playerRoom, setPlayerRoom] = useState(false);
  const [playerRole, setPlayerRole] = useState("");
  const [failReason, setFailReason] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEntered, setCaptchaEntered] = useState(false);

  const setInGame: React.Dispatch<React.SetStateAction<boolean>> =
    useOutletContext();

  useEffect(() => {
    setInGame(playerRole !== "");
  }, [playerRole, setInGame]);

  if (playerRoom) {
    /* Shows the room if a name and room has been selected */
    return (
      <Card
        style={{ margin: "2vh", display: "flex", flex: 1, overflow: "hidden" }}
      >
        <Card.Body
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Card.Text>
            Your Name is {playerName}.
            {playerRole !== "" ? " Your role is " + playerRole + "." : ""}{" "}
            {playerRole !== "" && (
              <OverlayTrigger
                placement="right"
                delay={{ show: 250, hide: 400 }}
                overlay={(props: React.HTMLAttributes<HTMLDivElement>) => (
                  <Tooltip id="button-tooltip" {...props}>
                    {roles.get(playerRole)}
                  </Tooltip>
                )}
              >
                <Button size="sm" variant="danger">
                  ?
                </Button>
              </OverlayTrigger>
            )}
          </Card.Text>
          <Room
            captchaToken={captchaToken}
            setFailReason={setFailReason}
            setName={setPlayerName}
            setRoom={setPlayerRoom}
            setRole={setPlayerRole}
          />
        </Card.Body>
      </Card>
    );
  } else {
    return (
      <Card className="text-center" style={{ margin: "2vh", flex: 1 }}>
        <Card.Body style={{ display: "flex", flexDirection: "column" }}>
          <Card.Title className="text-center">Play</Card.Title>
          {failReason !== "" && <Card.Text>{failReason}</Card.Text>}
          <Card.Text>
            This game was created by Lachlan Wright, you can view my GitHub
            profile <a href="http://www.github.com/LachlanBWWright">here,</a> or
            the repository for this game{" "}
            <a href="https://github.com/LachlanBWWright/LBWW-Mafia">here.</a>
          </Card.Text>
          <Card.Text>
            This is an online game similar to the 'mafia' party game. Most
            players are members of the town, while a few are mafia.
          </Card.Text>
          <div style={{ flex: 1 }}></div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignContent: "center",
            }}
          >
            <div style={{ flex: 1 }}></div>
            <ReCAPTCHA
              sitekey={"6Ld_zH4fAAAAAG24myzdi4un9qbSOtg9J08-xquF"}
              onChange={(token) => {
                if (token === null) return;
                setCaptchaToken(token);
                setCaptchaEntered(true);
              }}
            />
            <div style={{ flex: 1 }}></div>
          </div>
          <Button
            variant="danger"
            size="lg"
            style={{ width: "100%" }}
            onClick={() => {
              setPlayerRoom(true);
              setCaptchaEntered(false);
            }}
            disabled={!captchaEntered && !debug}
          >
            Join A Match!
          </Button>
        </Card.Body>
      </Card>
    );
  }
}
