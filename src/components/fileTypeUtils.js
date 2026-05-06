export const extOf = (f) =>
  String(f?.originalFilename || f?.title || f?.url || "")
    .split(".")
    .pop()
    ?.split(/[?#]/)[0]
    ?.toLowerCase() || "";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];

export const isImg = (f) =>
  f?.resourceType === "image" ||
  String(f?.mimeType || "").startsWith("image/") ||
  IMAGE_EXTS.includes(extOf(f));

export const isVid = (f) =>
  f?.resourceType === "video" ||
  String(f?.mimeType || "").startsWith("video/") ||
  VIDEO_EXTS.includes(extOf(f));

export const isPdf = (f) =>
  String(f?.mimeType || "").includes("pdf") || extOf(f) === "pdf";

export const isDoc = (f) => ["doc", "docx"].includes(extOf(f));

export const isPpt = (f) => ["ppt", "pptx", "pps", "ppsx"].includes(extOf(f));

export const imageDisplayUrl = (f) => {
  const url = f?.url || "";

  if (!isImg(f)) return url;

  if (["heic", "heif"].includes(extOf(f)) && url.includes("/image/upload/")) {
    return url.replace("/image/upload/", "/image/upload/f_jpg,q_auto/");
  }

  if (url.includes("/image/upload/")) {
    return url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
  }

  return url;
};

export const supportsWorkspace = (file) =>
  isDoc(file) || isPpt(file) || isImg(file) || isVid(file) || isPdf(file);