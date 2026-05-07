import FileWorkspace from "./FileWorkspace";
import {
  isDoc,
  isPpt,
  supportsWorkspace,
  isImg,
  isVid,
  imageDisplayUrl,
} from "./fileTypeUtils";
import {
  FileText,
  FileCode2,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  Presentation,
  ExternalLink,
} from "lucide-react";

const ICONS = {
  text: FileText,
  code: FileCode2,
  archive: FileArchive,
  spreadsheet: FileSpreadsheet,
  image: FileImage,
  video: FileVideo,
  presentation: Presentation,
};

const isImageFile = isImg;

const isVideoFile = isVid;

const getExtension = (name = "") => {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};

const getFileIconKey = (item) => {
  const mime = String(item?.mimeType || "").toLowerCase();
  const ext = getExtension(item?.originalFilename || item?.title || "");

  if (isImageFile(item)) return "image";
  if (isVideoFile(item)) return "video";
  if (mime.includes("pdf")) return "text";
  if (["ppt", "pptx", "key"].includes(ext)) return "presentation";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";

  if (
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("python") ||
    mime.includes("java") ||
    mime.includes("xml") ||
    mime.includes("html") ||
    mime.includes("css") ||
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "c",
      "cs",
      "rb",
      "go",
      "php",
      "swift",
      "kt",
      "sql",
      "html",
      "css",
      "json",
      "md",
      "xml",
      "yml",
      "yaml",
    ].includes(ext)
  ) {
    return "code";
  }

  return "text";
};

export default function FilePreview({
  file,
  alt,
  className = "",
  fit = "cover",
  interactive = false,
  onClick,
  showOpenLink = false,
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

  if (showOpenLink && (isDoc(file) || isPpt(file))) {
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

  const iconKey = getFileIconKey(file);
  const SelectedIcon = ICONS[iconKey] || FileText;

  const ext = getExtension(file.originalFilename || file.title || "");
  const label =
    ext
      ? ext.toUpperCase()
      : (file.mimeType || "FILE").split("/").pop()?.toUpperCase() || "FILE";

  return (
    <div
      role={interactive || onClick ? "button" : undefined}
      tabIndex={interactive || onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          (interactive || onClick) &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onClick?.(event);
        }
      }}
      className={`flex flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center dark:bg-slate-800 ${heightClass} ${className} ${interactive || onClick ? "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" : ""}`.trim()}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
        <SelectedIcon size={28} />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label} file
        </p>
        {file.originalFilename && (
          <p className="mt-1 max-w-[18rem] break-all text-xs text-slate-500 dark:text-slate-400">
            {file.originalFilename}
          </p>
        )}
      </div>

      {showOpenLink && (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ExternalLink size={16} />
          Open file
        </a>
      )}
    </div>
  );
}
