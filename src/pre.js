import * as core from "@actions/core";
import fs from "fs";

(async () => {
  try {
    core.startGroup("Pre: setup pa11y-ci workspace");
    fs.mkdirSync(".pa11y-tmp", { recursive: true });
    core.exportVariable("PA11Y_TMPDIR", ".pa11y-tmp");
    core.endGroup();
  } catch (e) {
    core.warning(`Pre-step warning: ${e instanceof Error ? e.message : e}`);
  }
})();