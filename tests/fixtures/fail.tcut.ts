import { defineVideo } from "tcut";

export default defineVideo({ output: "/tmp/tcut-test/fail.mp4", shell: "bash" }, async (t) => {
  await t.run("echo present");
  await t.expect(/definitely-absent/);
});
