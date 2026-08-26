import { type AnnotationHandler, type CustomPreProps, getPreRef, InnerPre, InnerToken } from "codehike/code";
import { calculateTransitions, getStartingSnapshot, type TokenTransitionsSnapshot } from "codehike/utils/token-transitions";
import { Component } from "react";

const MAX_TRANSITION_MS = 700;

/** Tokens that exist in both the old and the new code move to their new place; the rest fade. */
class SmoothPre extends Component<CustomPreProps> {
  private readonly ref = getPreRef(this.props);

  override render() {
    return <InnerPre merge={this.props} style={{ position: "relative" }} />;
  }

  override getSnapshotBeforeUpdate(): TokenTransitionsSnapshot | null {
    return this.ref.current ? getStartingSnapshot(this.ref.current) : null;
  }

  override componentDidUpdate(_prevProps: CustomPreProps, _prevState: never, snapshot: TokenTransitionsSnapshot | null) {
    const pre = this.ref.current;
    if (!pre || !snapshot) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const { element, keyframes, options } of calculateTransitions(pre, snapshot)) {
      const { translateX, translateY, ...rest } = keyframes;
      const frames: PropertyIndexedKeyframes = { ...rest };
      if (translateX && translateY) frames.translate = [`${translateX[0]}px ${translateY[0]}px`, `${translateX[1]}px ${translateY[1]}px`];
      element.animate(frames, { duration: options.duration * MAX_TRANSITION_MS, delay: options.delay * MAX_TRANSITION_MS, easing: options.easing, fill: "both" });
    }
  }
}

export const tokenTransitions: AnnotationHandler = {
  name: "token-transitions",
  PreWithRef: SmoothPre,
  Token: (props) => <InnerToken merge={props} style={{ display: "inline-block" }} />,
};
