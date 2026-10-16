import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateToolPath = "plugins/author-pattern-consolidator/index.js";
const publicControlPath = "CNAME";

test("jekyll excludes private consolidator tooling from static files", () => {
  assert.ok(
    existsSync(resolve(projectRoot, privateToolPath)),
    `expected the consolidator source to remain at ${privateToolPath}`,
  );

  const ruby = String.raw`
    require "json"
    require "jekyll"
    require "pathname"

    source = File.expand_path(ARGV.fetch(0))
    config = Jekyll.configuration("source" => source)
    site = Jekyll::Site.new(config)
    Jekyll::Reader.new(site).read

    puts JSON.generate(
      site.static_files.map do |file|
        Pathname(file.path).relative_path_from(Pathname(source)).to_s
      end
    )
  `;

  const output = execFileSync(
    "bundle",
    ["exec", "ruby", "-e", ruby, projectRoot],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, JEKYLL_ENV: "production" },
    },
  );
  const selectedStaticPaths = JSON.parse(output.trim().split("\n").at(-1));

  assert.ok(
    selectedStaticPaths.includes(publicControlPath),
    `expected public control asset ${publicControlPath} to remain selected`,
  );
  assert.ok(
    !selectedStaticPaths.some((path) =>
      path.startsWith("plugins/author-pattern-consolidator/"),
    ),
    `expected private consolidator tooling to be excluded, but Jekyll selected: ${selectedStaticPaths
      .filter((path) => path.startsWith("plugins/author-pattern-consolidator/"))
      .join(", ")}`,
  );
});
