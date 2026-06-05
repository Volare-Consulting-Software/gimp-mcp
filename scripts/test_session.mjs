// Validate the GimpSession class: run the transparency workflow as separate
// atomic eval() calls and confirm state (image/layer ids, selection) persists.
import { session } from "../dist/gimp/session.js";

const SRC = "C:/Users/admin/Desktop/lyw9406w53bi1cwrbkw7efgk.png";
const OUT = "C:/Users/admin/Desktop/session_test.png";
const q = (s) => `"${s}"`;

try {
  console.log("ver:", await session.eval("(gimp-version)"));

  const img = parseInt(await session.eval(`(car (gimp-file-load RUN-NONINTERACTIVE ${q(SRC)} ${q(SRC)}))`), 10);
  console.log("opened image id:", img);

  const layer = parseInt(await session.eval(`(vector-ref (car (gimp-image-get-layers ${img})) 0)`), 10);
  console.log("layer id:", layer);

  // state persists: query width using ids from earlier calls
  console.log("size:", await session.eval(`(list (car (gimp-image-get-width ${img})) (car (gimp-image-get-height ${img})))`));

  await session.eval(`(gimp-layer-add-alpha ${layer})`);
  await session.eval("(gimp-context-set-sample-threshold 0.22)");
  await session.eval(`(gimp-image-select-contiguous-color ${img} CHANNEL-OP-REPLACE ${layer} 5 5)`);
  await session.eval(`(gimp-image-select-contiguous-color ${img} CHANNEL-OP-ADD ${layer} 1400 5)`);
  await session.eval(`(gimp-image-select-contiguous-color ${img} CHANNEL-OP-ADD ${layer} 5 760)`);
  await session.eval(`(gimp-image-select-contiguous-color ${img} CHANNEL-OP-ADD ${layer} 1400 760)`);
  await session.eval(`(gimp-drawable-edit-clear ${layer})`);
  await session.eval(`(gimp-selection-none ${img})`);
  await session.eval(`(gimp-file-save RUN-NONINTERACTIVE ${img} ${q(OUT)})`);
  console.log("exported:", OUT);

  // error handling check
  try {
    await session.eval("(this-is-not-a-proc 1 2)");
    console.log("ERROR-CHECK: no error thrown (unexpected)");
  } catch (e) {
    console.log("ERROR-CHECK ok:", e.message.slice(0, 60));
  }
} catch (e) {
  console.log("FAILED:", e.message);
} finally {
  session.stop();
  setTimeout(() => process.exit(0), 300);
}
