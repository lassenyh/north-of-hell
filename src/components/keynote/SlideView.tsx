"use client";
import Image from "next/image";
import { useRef, useState, Fragment } from "react";
import type { RichText, Slide } from "@/lib/keynote/model";
import { PUBLIC_KEYNOTE_FILM } from "@/lib/public-video-paths";
import styles from "@/app/main/keynote.module.css";
const filmSource = PUBLIC_KEYNOTE_FILM;
function FilmPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playError, setPlayError] = useState(false);

  async function startFilm() {
    const video = videoRef.current;
    if (!video) return;
    setPlayError(false);
    try {
      await video.play();
      video.focus({ preventScroll: true });
    } catch {
      setPlayError(true);
    }
  }

  return (
    <div className={styles.filmPlayer}>
      <video
        ref={videoRef}
        className={styles.playerVideo}
        src={filmSource}
        controls={started}
        playsInline
        preload="metadata"
        tabIndex={started ? 0 : -1}
        onPlay={() => setStarted(true)}
        aria-label="North of Hell film"
      />
      {!started && (
        <button
          type="button"
          className={styles.playButton}
          onClick={startFilm}
          aria-label="Play North of Hell film"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </button>
      )}
      {playError && (
        <span className={styles.playError} role="status">
          Unable to play. Press play to try again.
        </span>
      )}
    </div>
  );
}

export function TitleArtwork() {
  return (
    <span className={styles.titleArtwork}>
      <Image
        src="/Login-assets/NOH_TITLE_C72B1F.png"
        alt="North of Hell"
        width={7373}
        height={1562}
        priority
        className="h-auto w-full brightness-0"
      />
      <Image
        src="/Login-assets/NOH_FILM_BY_C72B1F.png"
        alt="A film by Niels Windfeldt"
        width={2793}
        height={134}
        priority
        className="mx-auto mt-[7.07%] h-auto w-[37.88%] brightness-0"
      />
    </span>
  );
}

function RichView({ doc }: { doc: RichText }) {
  return doc.content.map((p, i) => (
    <span className={styles.posterParagraph} key={i}>
      {p.content?.map((n, j) =>
        n.type === "hardBreak" ? (
          <br key={j} />
        ) : n.marks?.length ? (
          <em key={j}>{n.text}</em>
        ) : (
          <Fragment key={j}>{n.text}</Fragment>
        ),
      )}
    </span>
  ));
}
export function SlideView({
  slide,
  thumbnail = false,
  onField,
}: {
  slide: Slide;
  thumbnail?: boolean;
  onField?: (field: "heading" | "body") => void;
}) {
  if (slide.type === "title") return <TitleArtwork />;
  if (slide.type === "video")
    return thumbnail ? (
      <video
        className={styles.film}
        src={`${filmSource}#t=0.1`}
        muted
        playsInline
        preload="none"
        aria-hidden="true"
      />
    ) : (
      <FilmPlayer />
    );
  if (slide.layout === "short")
    return (
      <div
        data-slide-text
        className={styles.logline}
        onClick={() => onField?.("body")}
      >
        <RichView doc={slide.body} />
      </div>
    );
  return (
    <div
      data-slide-text
      className={`${styles.poster} ${slide.density === "short" ? styles.genre : styles.synopsis}`}
    >
      <div
        role="heading"
        aria-level={2}
        className={styles.posterTitle}
        onClick={() => onField?.("heading")}
      >
        {slide.heading}
      </div>
      <div className={styles.posterBody} onClick={() => onField?.("body")}>
        <RichView doc={slide.body} />
      </div>
    </div>
  );
}
