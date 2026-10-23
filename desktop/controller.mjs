import profiles from "../shared/game/botProfiles.json" with { type: "json" };

export function trustedOrigin(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname))
    )
  )
    throw new Error(
      "Use HTTPS for the app and game server, or a local development address.",
    );
  return url.origin;
}

export function createDesktopController({
  runtime,
  runner,
  open,
  socketOrigin,
}) {
  const groups = new Set();
  let generation = 0;
  let closed = false;
  const stop = () => {
    generation += 1;
    for (const group of groups) group.stop();
    groups.clear();
  };
  return {
    async invoke(method, body) {
      if (closed) throw new Error("The desktop ChatGPT connection is closed.");
      switch (method) {
        case "status":
          return runtime.connection();
        case "models":
          return runtime.models();
        case "connect": {
          const { authorizationUrl } = await runtime.startSignIn();
          try {
            const url = new URL(authorizationUrl);
            if (
              url.origin !== "https://auth.openai.com" ||
              url.pathname !== "/api/accounts/authorize" ||
              url.username ||
              url.password ||
              url.hash
            )
              throw new Error("Invalid ChatGPT sign-in address.");
            await open(url.href);
          } catch (error) {
            runtime.cancelSignIn();
            throw error;
          }
          return {};
        }
        case "cancel":
          runtime.cancelSignIn();
          return {};
        case "retry":
          runtime.retryUsage();
          return {};
        case "disconnect":
          stop();
          return runtime.signOut();
        case "join": {
          const expected = generation;
          const url = new URL(body?.socketUrl);
          if (
            url.origin !== socketOrigin ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== "/" ||
            typeof body.room !== "string" ||
            !body.room.trim() ||
            body.room.length > 128 ||
            !Array.isArray(body.tickets) ||
            body.tickets.length < 1 ||
            body.tickets.length > 12 ||
            !Array.from(body.tickets).every(
              (ticket) =>
                typeof ticket === "string" &&
                ticket.length > 0 &&
                ticket.length <= 4096,
            ) ||
            typeof body.model !== "string" ||
            body.model.length === 0 ||
            body.model.length > 200 ||
            !["shared", "per-character"].includes(body.mode) ||
            (body.personality !== "varied" &&
              !profiles.personalities.some(
                (item) => item.id === body.personality,
              )) ||
            !profiles.difficulties.some((item) => item.id === body.difficulty)
          )
            throw new Error("Invalid AI character configuration.");
          const account = await runtime.connection();
          if (!account.connected || !account.planEnabled || account.usagePaused)
            throw new Error(
              "Connect your ChatGPT plan before adding characters.",
            );
          if (
            !(await runtime.models()).some((model) => model.slug === body.model)
          )
            throw new Error("Choose an available ChatGPT model.");
          if (closed || generation !== expected)
            throw new Error("The ChatGPT connection changed. Try again.");
          const group = runner.startBotSeats({
            ...body,
            url: socketOrigin,
            captcha: "",
          });
          groups.add(group);
          return { added: group.length };
        }
        default:
          throw new Error("Unsupported desktop action.");
      }
    },
    close() {
      if (closed) return;
      closed = true;
      stop();
      runtime.close();
    },
  };
}

export function acceptsSender(event, window, appOrigin) {
  try {
    return (
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame &&
      new URL(event.senderFrame.url).origin === appOrigin
    );
  } catch {
    return false;
  }
}
