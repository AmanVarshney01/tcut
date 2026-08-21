import { Player } from "@remotion/player";
import { Promo, PROMO_DURATION } from "./Promo";

/** The launch video, running live in the browser: the same Remotion composition that rendered promo.mp4. */
export default function PromoPlayer() {
  return (
    <Player
      component={Promo}
      durationInFrames={PROMO_DURATION}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#0b0b12" }}
      controls
      autoPlay
      loop
      initiallyMuted
      showVolumeControls={false}
      clickToPlay
      doubleClickToFullscreen
      spaceKeyToPlayOrPause
      acknowledgeRemotionLicense
    />
  );
}
