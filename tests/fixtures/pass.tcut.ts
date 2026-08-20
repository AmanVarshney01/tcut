import { defineVideo } from "tcut";

export default defineVideo({ output: "/tmp/tcut-test/pass.mp4", shell: "bash" }, async (t) => {
  await t.run("echo $((6 * 7))");
  await t.expect(/^42$/m);
  await t.sleep("30s"); // skipped in fast mode
});
