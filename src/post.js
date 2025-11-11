import * as core from "@actions/core";
import fs from "fs";

(async () => {
  try {
    core.startGroup("Post: cleanup");
    const d = process.env.PA11Y_TMPDIR;
    if (d && fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
      core.info(`Removed ${d}`);
    }
    core.endGroup();
  } catch (e) {
    core.warning(`Post-step warning: ${e instanceof Error ? e.message : e}`);
  }
})();