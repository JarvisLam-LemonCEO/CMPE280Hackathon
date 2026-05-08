import FileWorkspace from "./FileWorkspace";
import {
  supportsWorkspace,
  isImg,
  isVid,
  imageDisplayUrl,
} from "./fileTypeUtils";
import {
  FileText,
} from "lucide-react";

const isImageFile = isImg;

const isVideoFile = isVid;

export default function FilePreview({
  file,
  alt,
  className = "",
  fit = "cover",
  interactive = false,
  onClick,
  heightClass = "h-full",
  editor = false,
}) {
  if (!file?.url) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${className}`}
      >
        <FileText size={28} />
      </div>
    );
  }

  if (editor && supportsWorkspace(file)) {
    return (
      <div className={`${heightClass} ${className}`.trim()}>
        <FileWorkspace file={file} />
      </div>
    );
  }

  if (isImageFile(file)) {
    return (
      <img
        src={imageDisplayUrl(file)}
        alt={alt || file.title || file.originalFilename || "Uploaded file"}
        onClick={onClick}
        className={`${className} ${interactive ? "cursor-pointer" : ""}`.trim()}
        style={{ objectFit: fit }}
      />
    );
  }

  if (isVideoFile(file)) {
    if (interactive) {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClick?.(event);
            }
          }}
          className={`relative overflow-hidden bg-black ${className} cursor-pointer`.trim()}
        >
          <video
            src={file.url}
            preload="metadata"
            playsInline
            className="h-full w-full object-cover"
          />
          {file.annotationOverlayUrl && (
            <img
              src={file.annotationOverlayUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
          )}
          <div className="absolute inset-0" onClick={onClick} />
        </div>
      );
    }

    return (
      <div className={`relative bg-black ${className}`.trim()}>
        <video
          src={file.url}
          controls
          preload="metadata"
          className="h-full w-full object-contain"
        />

        {file.annotationOverlayUrl && (
          <img
            src={file.annotationOverlayUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${heightClass} ${className}`.trim()}
    >
      <FileText size={28} />
    </div>
  );
}
