const extensionFrom = (value) => {
  const cleanValue = String(value || "").split(/[?#]/)[0];
  const parts = cleanValue.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};

export const extOf = (f) =>
  [f?.originalFilename, f?.url, f?.title]
    .map(extensionFrom)
    .find(Boolean) || "";

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

export const supportsWorkspace = (file) => isImg(file) || isVid(file);

export const contentTypeOf = (file) => {
  if (!file) return "image";
  if (file.isGeneratedVideo || isVid(file)) return "video";
  if (isImg(file)) return "image";
  return "image";
};
