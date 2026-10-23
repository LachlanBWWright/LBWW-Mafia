import config from "./config.json" with { type: "json" };
import { trustedOrigin } from "./controller.mjs";
for (const [name, value] of Object.entries(config)) {
  if (!value || !value.startsWith("https://"))
    throw new Error(
      `Set desktop/config.json ${name} to its deployed HTTPS address before distributing.`,
    );
  trustedOrigin(value);
}
