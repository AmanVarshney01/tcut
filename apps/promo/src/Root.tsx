import "@fontsource-variable/jetbrains-mono";
import React from "react";
import { Composition } from "remotion";
import { PROMO_DURATION, Promo } from "./Promo";

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1920} height={1080} />
);
