import { useId, useRef, useState } from "react";
import { ArrowUpRight, Play, Volume2, VolumeX, X } from "lucide-react";
import "./product-film.css";

const film = "/product-film/advisio-research-connected-1080p.mp4";
const poster = "/product-film/workspace-at-0036.jpg";

export function ProductFilm() {
  const titleId = useId();
  const dialogTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  function openFilm() {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video || dialog.open) return;

    setFailed(false);
    dialog.showModal();
    video.src = film;
    const captions = video.textTracks[0];
    if (captions) captions.mode = "showing";
    // Start within the button's user gesture. Native controls also allow
    // manual playback if browser policy blocks the play request.
    void video.play().catch(() => {});
  }

  function releaseFilm() {
    const video = videoRef.current;
    if (!video || dialogRef.current?.open) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = 1;
      video.muted = false;
    } else {
      video.muted = true;
    }
  }

  return (
    <section
      id="product-film"
      className="lp-film-section"
      aria-labelledby={titleId}
    >
      <div className="lp-container">
        <div className="lp-film-card">
          <div className="lp-film-copy">
            <p className="lp-eyebrow">
              <span className="lp-status-dot" /> Product film
            </p>
            <h2 id={titleId}>Research, connected.</h2>
            <p className="lp-film-intro">
              See how Advisio brings the research workflow together.
            </p>
            <button type="button" className="lp-film-link" onClick={openFilm}>
              Watch the film <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="lp-film-poster"
            aria-label="Play the Advisio product film, 3 minutes 45 seconds"
            onClick={openFilm}
          >
            <img
              src={poster}
              alt=""
              width={1920}
              height={1080}
              loading="lazy"
            />
            <span className="lp-film-play" aria-hidden="true">
              <Play size={23} fill="currentColor" />
            </span>
            <span className="lp-film-duration" aria-hidden="true">
              3:45
            </span>
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="lp-film-dialog"
        aria-labelledby={dialogTitleId}
        onClose={releaseFilm}
      >
        <div className="lp-film-dialog-header">
          <h2 id={dialogTitleId}>Research, connected.</h2>
          <div className="lp-film-controls">
            <button type="button" onClick={toggleMute}>
              {muted ? (
                <VolumeX size={19} aria-hidden="true" />
              ) : (
                <Volume2 size={19} aria-hidden="true" />
              )}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              aria-label="Close film"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
        <video
          ref={videoRef}
          aria-label="Advisio product film"
          controls
          playsInline
          preload="none"
          poster={poster}
          onVolumeChange={({ currentTarget }) =>
            setMuted(currentTarget.muted || currentTarget.volume === 0)
          }
          onError={() => {
            if (dialogRef.current?.open) setFailed(true);
          }}
        >
          <track
            kind="captions"
            src="/product-film/subtitles.vtt"
            srcLang="en"
            label="English"
            default
          />
        </video>
        {failed && (
          <p className="lp-film-error" role="status">
            The film couldn’t load.{" "}
            <a href={film} target="_blank" rel="noreferrer">
              Open the MP4 in a new tab.
            </a>
          </p>
        )}
      </dialog>
    </section>
  );
}
