"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { IMAGE_RETRY_DELAYS, imageRetrySource } from "@/lib/storyboard/image-retry";
import "./retryable-image.css";

type RetryableImageProps = Omit<ImageProps, "src" | "onError" | "onLoad"> & { src: string };

export function RetryableImage(props: RetryableImageProps) {
  // A different source starts a fresh retry budget and cancels pending timers.
  return <ImageWithRetries key={props.src} {...props} />;
}

function ImageWithRetries({ src, alt, fill, width, height, ...props }: RetryableImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState("");
  const sequence = useRef(0);
  const exhausted = failed && attempt >= IMAGE_RETRY_DELAYS.length;
  const retrying = !loaded && (failed || attempt > 0 || !!token) && !exhausted;

  useEffect(() => {
    if (!failed || attempt >= IMAGE_RETRY_DELAYS.length) return;
    const timeout = window.setTimeout(() => {
      setToken(`${Date.now()}-${++sequence.current}`);
      setAttempt(value => value + 1);
      setFailed(false);
    }, IMAGE_RETRY_DELAYS[attempt]);
    return () => window.clearTimeout(timeout);
  }, [failed, attempt]);

  const ratio = Number(width) > 0 && Number(height) > 0 ? `${Number(width)} / ${Number(height)}` : undefined;
  return <span className={`sb-retry-image${fill ? " sb-retry-image--fill" : ""}${!loaded && (failed || retrying) ? " has-load-error" : ""}`} style={fill ? undefined : { aspectRatio: ratio }}>
    <Image {...props} key={token || "initial"} src={imageRetrySource(src, token)} alt={alt} fill={fill} width={width} height={height} onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => { setLoaded(false); setFailed(true); }} />
    {(retrying || exhausted) && <span className="sb-image-recovery">
      <span role="status">{exhausted ? `Could not load image${alt ? ` ${alt}` : ""}.` : "Loading image again…"}</span>
      {exhausted && <button type="button" aria-label={`Retry loading image${alt ? ` ${alt}` : ""}`} onClick={event => {
        event.stopPropagation();
        setAttempt(0); setFailed(false); setLoaded(false);
        setToken(`${Date.now()}-${++sequence.current}`);
      }}>Try again</button>}
    </span>}
  </span>;
}
