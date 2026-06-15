import { spawnSync } from "node:child_process";

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("prisma generate");

if (process.env.VERCEL_ENV === "production") {
  run("prisma migrate deploy");
} else {
  console.log(
    `Skipping prisma migrate deploy because VERCEL_ENV is ${process.env.VERCEL_ENV ?? "unset"}.`,
  );
}

run("next build");
