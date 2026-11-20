const arguments_ = process.argv.slice(2);
if (arguments_[0] === "--") arguments_.shift();
const [command, ...args] = arguments_;

try {
  if (command === "api-run") {
    const { runApiBots } = await import("./api/run.mjs");
    await runApiBots(args[0]);
  } else if (command === "serve") {
    await import("./bridge.mjs");
  } else if (command === "connect") {
    const { signInWithChatGPT } = await import("./chatgpt-plan.mjs");
    const connection = await signInWithChatGPT();
    process.stdout.write(
      `Connected ${connection.email}. Credentials are stored locally at ${connection.credentialPath}.\n`,
    );
  } else if (command === "status") {
    const { chatGPTConnection } = await import("./chatgpt-plan.mjs");
    const connection = await chatGPTConnection();
    process.stdout.write(
      connection.connected
        ? `Connected: ${connection.email ?? "ChatGPT account"}\n`
        : "ChatGPT is not connected.\n",
    );
  } else if (command === "models") {
    const { listChatGPTModels } = await import("./chatgpt-plan.mjs");
    for (const model of await listChatGPTModels())
      process.stdout.write(`${model.slug}\t${model.name}\n`);
  } else if (command === "ask") {
    const [model, ...promptParts] = args;
    const prompt = promptParts.join(" ").trim();
    if (!model || !prompt)
      throw new Error("Usage: pnpm run ai-bots -- ask <model> <prompt>");
    const { generateWithChatGPT } = await import("./chatgpt-plan.mjs");
    const answer = await generateWithChatGPT({
      model,
      instructions: "Answer the user's request concisely.",
      input: prompt,
    });
    process.stdout.write(`${answer}\n`);
  } else {
    process.stdout.write(
      "LBWW Mafia local AI runtime\n\nCommands:\n  pnpm run ai-bots -- api-run <seat-options.json>\n  pnpm run ai-bots:connect\n  pnpm run ai-bots -- serve\n  pnpm run ai-bots -- status\n  pnpm run ai-bots -- models\n  pnpm run ai-bots -- ask <model> <prompt>\n",
    );
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "AI runtime operation failed."}\n`,
  );
  process.exitCode = 1;
}
