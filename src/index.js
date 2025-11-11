import * as core from "@actions/core";
import * as github from "@actions/github";

// pa11y-ci exposes a bin and a programmatic API. We'll call the bin to keep parity with CLI flags.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";

function buildArgs({ url, config, standard, wait, headers, reporter, extraArgs }) {
  const args = [];

  if (config) {
    args.push("--config", config);
  } else if (url) {
    args.push("--url", url);
  } else {
    core.setFailed("You must provide either `url` or `config` input.");
    process.exit(2);
  }

  if (standard) args.push("--standard", standard);
  if (wait && wait !== "0") args.push("--wait", String(wait));
  if (headers) args.push("--headers", headers);
  if (reporter) args.push("--reporter", reporter);

  if (extraArgs && extraArgs.trim().length > 0) {
    // naive split (document you accept simple space-separated args)
    args.push(...extraArgs.split(" ").filter(Boolean));
  }

  return args;
}

async function run() {
  try {
    const inputs = {
      url: core.getInput("url"),
      config: core.getInput("config"),
      standard: core.getInput("standard") || "WCAG2AA",
      threshold: Number(core.getInput("threshold") || "0"),
      wait: core.getInput("wait") || "0",
      headers: core.getInput("headers") || "",
      reporter: core.getInput("reporter") || "json",
      report_file: core.getInput("report_file") || "pa11y-report.json",
      extraArgs: core.getInput("extra_args") || ""
    };

    core.startGroup("Inputs");
    core.info(JSON.stringify({ ...inputs, headers: inputs.headers ? "[set]" : "" }, null, 2));
    core.endGroup();

    const args = buildArgs(inputs);
    const reportPath = resolve(process.env.GITHUB_WORKSPACE || process.cwd(), inputs.report_file);
    core.info(`Report will be saved to: ${reportPath}`);

    // spawn pa11y-ci bin
    const child = spawn(process.execPath, [require.resolve("pa11y-ci/bin/pa11y-ci.js"), ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    // capture stdout to file so we can parse/enforce threshold
    const out = createWriteStream(reportPath);
    child.stdout.pipe(out);

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));

    const exitCode = await new Promise((resolveCode) => {
      child.on("close", (code) => resolveCode(code ?? 1));
    });

    core.info(`pa11y-ci exit code: ${exitCode}`);
    core.setOutput("report_path", reportPath);
    core.setOutput("exit_code", String(exitCode));

    // If JSON, try threshold enforcement ourselves only when pa11y-ci succeeded (0)
    if (inputs.reporter === "json" && exitCode === 0) {
      try {
        const fs = await import("node:fs/promises");
        const raw = await fs.readFile(reportPath, "utf8");

        let report;
        try {
          report = JSON.parse(raw);
        } catch {
          // attempt to trim banners
          const trimmed = raw.slice(raw.indexOf("{")).trim();
          report = JSON.parse(trimmed);
        }

        // pa11y-ci JSON is an object keyed by URL -> array of issues
        const total = Object.values(report).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
        core.info(`Issues found: ${total} (threshold ${inputs.threshold})`);

        if (inputs.threshold >= 0 && total > inputs.threshold) {
          core.setFailed(`Accessibility issues exceed threshold: ${total} > ${inputs.threshold}`);
          return;
        }
      } catch (e) {
        core.warning(`Failed to parse/enforce JSON threshold: ${e instanceof Error ? e.message : e}`);
      }
    }

    // If pa11y-ci itself failed, fail the action with its code
    if (exitCode !== 0) {
      if (stderr) core.error(stderr);
      core.setFailed(`pa11y-ci exited with ${exitCode}`);
    } else {
      core.info(`Repo: ${github.context.repo.owner}/${github.context.repo.repo}`);
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();