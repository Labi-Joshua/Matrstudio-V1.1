"use client";

import { useEffect } from "react";
import { captureReferral } from "../lib/referral";

/** Remembers a ?ref= code from the address on any page; renders nothing. */
export function ReferralCapture() {
  useEffect(captureReferral, []);
  return null;
}
