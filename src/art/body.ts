/** Station-view scale: 1 m = 111 px, so a 1.8 m athlete stands 200 px tall. */
export const PX_PER_M = 111;

/** Bone lengths of the athlete rig, in px. */
export const BODY = {
  thigh: 48,
  shin: 46,
  /** Ankle joint height above the sole. */
  ankle: 8,
  /** Hip joint to shoulder joint. */
  torso: 56,
  /** Shoulder joint to the base of the skull. */
  neck: 10,
  upperArm: 34,
  forearm: 28,
  /** Wrist to the middle of the fist, where handles and balls are held. */
  grip: 5,
} as const;

export const HIP_HEIGHT = BODY.thigh + BODY.shin + BODY.ankle;
